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
    <header className="ia-concept-page-header">
      <div className="page-header-left">
        <h1 className={`ia-concept-page-title${titleClassName ? ` ${titleClassName}` : ""}`}>{title}</h1>
        {subtitle ? <p className="ia-concept-page-note">{subtitle}</p> : null}
      </div>
      {children ? <div className="page-header-right">{children}</div> : null}
    </header>
  );
}
