import Badge from "./common/Badge";

export default function StatusBadge(props: { status: string; threads?: number }) {
  return <Badge {...props} />;
}
