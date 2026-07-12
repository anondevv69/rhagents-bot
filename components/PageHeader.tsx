export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <h1 className="page-header-title">{title}</h1>
      {children}
      {subtitle ? <p className="page-header-subtitle">{subtitle}</p> : null}
    </header>
  );
}
