// src/components/DynamicIcon.tsx
// Renderiza qualquer ícone do Lucide React a partir de uma string com o nome

import React from 'react';
import * as LucideIcons from 'lucide-react';

interface DynamicIconProps {
  name: string;
  className?: string;
}

/**
 * Renderiza um ícone Lucide pelo nome (string).
 * Se o nome não existir, usa o ícone padrão Layout.
 *
 * @example <DynamicIcon name="FileText" className="h-5 w-5" />
 */
const DynamicIcon: React.FC<DynamicIconProps> = ({ name, className }) => {
  const Icon = (LucideIcons as any)[name] as React.FC<{ className?: string }> | undefined;

  if (!Icon) {
    const Fallback = LucideIcons.Layout;
    return <Fallback className={className} />;
  }

  return <Icon className={className} />;
};

export default DynamicIcon;
