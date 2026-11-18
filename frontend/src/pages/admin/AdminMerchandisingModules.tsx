import React from 'react';
import { AdminLayoutManagement } from './AdminLayoutManagement.tsx';

export function AdminHeroSliderSection() {
  return <AdminLayoutManagement initialTab="hero" />;
}

export function AdminHomepageLayoutSection() {
  return <AdminLayoutManagement initialTab="homepage" />;
}
