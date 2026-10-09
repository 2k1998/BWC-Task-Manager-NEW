"""Payment/car integration regressions using an isolated in-memory database.

Never reads or writes the configured application database.
"""
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import DefaultClause, MetaData, create_engine, event, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api import cars, payments
from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.models.car import Car
from app.models.car_expense import CarExpense
from app.models.car_income import CarIncome
from app.models.car_maintenance import CarMaintenance
from app.models.company import Company
from app.models.payment import Payment
from app.models.user import User
from app.models.permission import UserPermission


@pytest.fixture
def context(monkeypatch):
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )

    @event.listens_for(engine, "connect")
    def setup_sqlite(connection, _):
        connection.create_function("gen_random_uuid", 0, lambda: uuid4().hex)
        connection.execute("PRAGMA foreign_keys=ON")

    # SQLite requires parentheses around function defaults. Clone metadata so
    # the application models and their PostgreSQL defaults stay untouched.
    metadata = MetaData()
    for model in (User, UserPermission, Company, Car, Payment, CarIncome, CarExpense, CarMaintenance):
        table = model.__table__.to_metadata(metadata)
        for column in table.columns:
            if column.server_default is not None:
                default = str(column.server_default.arg)
                if default == "gen_random_uuid()":
                    column.server_default = DefaultClause(text("(gen_random_uuid())"))
                elif default == "NOW()":
                    column.server_default = DefaultClause(text("CURRENT_TIMESTAMP"))
    metadata.create_all(engine)
    with Session(engine, expire_on_commit=False) as db:
        actor = User(
            id=uuid4(), email="actor@test.local", username="actor",
            first_name="Test", last_name="Actor", hashed_password="unused",
            user_type="Agent", is_active=True,
        )
        company = Company(id=uuid4(), name="Test Company")
        car = Car(id=uuid4(), make="Toyota", model="Yaris", year=2022,
                  license_plate="TEST-1", status="available")
        second_car = Car(id=uuid4(), make="Ford", model="Focus", year=2021,
                         license_plate="TEST-2", status="sold")
        db.add_all([actor, company, car, second_car])
        db.flush()
        db.add_all([
            UserPermission(user_id=actor.id, module="payments", access_level="edit"),
            UserPermission(user_id=actor.id, module="cars", access_level="view"),
        ])
        db.commit()
        audit = []
        monkeypatch.setattr(payments, "log_activity", lambda **data: audit.append(data))
        monkeypatch.setattr(cars, "log_activity", lambda **data: audit.append(data))
        app = FastAPI()
        app.include_router(payments.router)
        app.include_router(cars.router)
        app.dependency_overrides[get_db] = lambda: db
        app.dependency_overrides[get_current_user] = lambda: actor
        app.dependency_overrides[require_admin] = lambda: actor
        with TestClient(app) as client:
            yield client, db, actor, company, car, second_car, audit
    engine.dispose()


def payload(context, **changes):
    return dict(title="Income", amount="150.00", payment_type="service",
                payment_date="2026-10-09", company_id=str(context[3].id),
                is_income=True, **changes)


def linked(context, source="car_rental"):
    response = context[0].post("/payments", json=payload(
        context, income_source=source, car_id=str(context[4].id)
    ))
    assert response.status_code == 201, response.text
    return response.json()


def deny_car_access(context):
    db, actor = context[1:3]
    db.query(UserPermission).filter_by(user_id=actor.id, module="cars").delete()
    db.commit()


@pytest.mark.parametrize("source", ["car_rental", "car_sale"])
def test_create_read_list_and_audit(context, source):
    result = linked(context, source)
    assert result["income_source"] == source
    assert result["car_id"] == str(context[4].id)
    assert context[0].get(f"/payments/{result['id']}").json()["car_id"] == result["car_id"]
    assert context[0].get("/payments").json()["payments"][0]["income_source"] == source
    snapshot = context[6][-1]["new_value"]
    assert snapshot["income_source"] == source
    assert snapshot["car_id"] == result["car_id"]
    assert context[4].status == "available"
    assert context[1].query(CarIncome).count() == 0


def test_legacy_other_income(context):
    response = context[0].post("/payments", json=payload(context))
    assert response.status_code == 201
    assert response.json()["income_source"] is None
    assert response.json()["car_id"] is None


@pytest.mark.parametrize("source", ["car_rental", "car_sale"])
def test_link_requires_car(context, source):
    response = context[0].post("/payments", json=payload(context, income_source=source))
    assert response.status_code == 400
    assert context[1].query(Payment).count() == 0


@pytest.mark.parametrize("car_id, status", [("malformed", 422), (str(uuid4()), 404)])
def test_invalid_car(context, car_id, status):
    response = context[0].post("/payments", json=payload(
        context, income_source="car_rental", car_id=car_id
    ))
    assert response.status_code == status


def test_invalid_source(context):
    response = context[0].post("/payments", json=payload(
        context, income_source="invalid", car_id=str(context[4].id)
    ))
    assert response.status_code == 422


def test_create_requires_car_view_permission(context):
    deny_car_access(context)
    response = context[0].post("/payments", json=payload(
        context, income_source="car_sale", car_id=str(context[4].id)
    ))
    assert response.status_code == 403
    assert context[1].query(Payment).count() == 0


def test_update_preserves_link_without_car_permission(context):
    result = linked(context)
    deny_car_access(context)
    response = context[0].put(f"/payments/{result['id']}", json={"title": "Adjusted"})
    assert response.status_code == 200, response.text
    assert response.json()["income_source"] == "car_rental"
    assert response.json()["car_id"] == result["car_id"]


@pytest.mark.parametrize("change", ["car", "source"])
def test_changing_link_requires_car_permission(context, change):
    result = linked(context)
    deny_car_access(context)
    data = ({"car_id": str(context[5].id)} if change == "car"
            else {"income_source": "car_sale"})
    response = context[0].put(f"/payments/{result['id']}", json=data)
    assert response.status_code == 403
    assert context[0].get(f"/payments/{result['id']}").json()["car_id"] == result["car_id"]


def test_partial_update_can_link_existing_other_income(context):
    result = context[0].post("/payments", json=payload(context)).json()
    response = context[0].put(f"/payments/{result['id']}", json={
        "income_source": "car_sale", "car_id": str(context[5].id)
    })
    assert response.status_code == 200
    assert response.json()["car_id"] == str(context[5].id)
    assert context[5].status == "sold"


@pytest.mark.parametrize("data", [{"income_source": None}, {"is_income": False}])
def test_update_clear_other_and_expense_without_car_permission(context, data):
    result = linked(context)
    deny_car_access(context)
    response = context[0].put(f"/payments/{result['id']}", json=data)
    assert response.status_code == 200, response.text
    assert response.json()["income_source"] is None
    assert response.json()["car_id"] is None
    assert context[6][-1]["old_value"]["car_id"] == result["car_id"]
    assert context[6][-1]["new_value"]["car_id"] is None


@pytest.mark.parametrize("data", [
    {"car_id": None}, {"car_id": str(uuid4())}, {"is_income": None}
])
def test_update_rejects_incomplete_missing_car_and_null_income(context, data):
    result = linked(context)
    response = context[0].put(f"/payments/{result['id']}", json=data)
    assert response.status_code in (400, 404)
    stored = context[0].get(f"/payments/{result['id']}").json()
    assert stored["car_id"] == result["car_id"]
    assert stored["is_income"] is True


def test_expense_create_discards_car_income_fields(context):
    data = payload(context, income_source="car_rental", car_id=str(context[4].id))
    data["is_income"] = False
    response = context[0].post("/payments", json=data)
    assert response.status_code == 201
    assert response.json()["income_source"] is None
    assert response.json()["car_id"] is None


def test_delete_car_with_payment_returns_conflict(context):
    linked(context)
    response = context[0].delete(f"/cars/{context[4].id}")
    assert response.status_code == 409
    assert "financial records" in response.json()["detail"]


@pytest.mark.parametrize("is_income, source, use_car", [
    (True, None, True), (False, "car_sale", True),
    (True, "car_rental", False), (True, "invalid", True),
])
def test_database_check_rejects_invalid_income_states(context, is_income, source, use_car):
    db, actor, company, car = context[1:5]
    from datetime import date
    db.add(Payment(
        title="Invalid", amount=10, currency="EUR", payment_type="service",
        payment_date=date(2026, 10, 9), is_income=is_income, income_source=source,
        car_id=car.id if use_car else None, company_id=company.id, created_by_user_id=actor.id,
    ))
    with pytest.raises(IntegrityError):
        db.flush()
    db.rollback()


def test_database_foreign_key_prevents_car_deletion(context):
    linked(context)
    db, car = context[1], context[4]
    db.delete(car)
    with pytest.raises(IntegrityError):
        db.flush()
    db.rollback()
