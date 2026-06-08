import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';

export default function ForbiddenPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-bg-base px-4 text-center">
      <div className="flex flex-col items-center gap-5">
        <p className="text-[120px] font-black leading-none text-text-disabled select-none">
          403
        </p>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-text-primary">Acceso denegado</h1>
          <p className="max-w-sm text-sm text-text-secondary">
            No tenés permisos para ver esta página. Contactá a un administrador si creés que es un error.
          </p>
        </div>
      </div>
      <Button variant="primary" onClick={() => navigate(-1)}>
        Volver atrás
      </Button>
    </div>
  );
}
