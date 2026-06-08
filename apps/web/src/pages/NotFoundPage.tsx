import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-bg-base px-4 text-center">
      <div className="flex flex-col items-center gap-5">
        <p className="text-[120px] font-black leading-none text-text-disabled select-none">
          404
        </p>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-text-primary">Página no encontrada</h1>
          <p className="max-w-sm text-sm text-text-secondary">
            La página que estás buscando no existe o fue movida a otra dirección.
          </p>
        </div>
      </div>
      <Link to="/dashboard">
        <Button variant="primary">Volver al dashboard</Button>
      </Link>
    </div>
  );
}
