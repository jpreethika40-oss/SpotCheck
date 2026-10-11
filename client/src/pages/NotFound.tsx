import React from 'react';
import { Link } from 'react-router-dom';
import { FileQuestion, ArrowLeft } from 'lucide-react';
import { Button } from '../components/common/Button';

export const NotFound: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6">
      <div className="w-14 h-14 rounded-full bg-sand-light text-terracotta flex items-center justify-center mb-4 border border-warm">
        <FileQuestion className="w-7 h-7" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-charcoal">404 — Page Not Found</h1>
      <p className="text-xs text-muted max-w-sm mt-1.5 mb-6">
        The requested facility route or module does not exist or has been relocated.
      </p>
      <Link to="/">
        <Button variant="primary" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
          Return to Dashboard
        </Button>
      </Link>
    </div>
  );
};
