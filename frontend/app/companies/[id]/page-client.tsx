'use client';

import React, { use } from 'react';
import CompanyDetails from '@/components/companies/CompanyDetails';

interface CompanyDetailsProps {
  params: Promise<{ id: string }>;
}

export default function CompanyDetailsPage(props: CompanyDetailsProps) {
  const { id } = use(props.params);
  return <CompanyDetails id={id} />;
}
