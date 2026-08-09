export function AppPageBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-body">
      <div className="content-area">{children}</div>
    </div>
  );
}
