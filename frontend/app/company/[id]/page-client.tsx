'use client';

import React, { use } from 'react';
import CompanyDetails from '@/components/companies/CompanyDetails';

interface CompanyAliasPageProps {
  params: Promise<{ id: string }>;
}

export default function CompanyAliasPage(props: CompanyAliasPageProps) {
  const { id } = use(props.params);
  return <CompanyDetails id={id} />;
}

