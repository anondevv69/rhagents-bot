export function PageHeader({
  title,
  subtitle,
  titleClassName,
  children,
}: {
  title: string;
  subtitle?: string;
  titleClassName?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header-left">
        <h1 className={`page-header-title${titleClassName ? ` ${titleClassName}` : ""}`}>{title}</h1>
        {subtitle ? <p className="page-header-subtitle">{subtitle}</p> : null}
      </div>
      {children ? <div className="page-header-right">{children}</div> : null}
    </header>
  );
}
