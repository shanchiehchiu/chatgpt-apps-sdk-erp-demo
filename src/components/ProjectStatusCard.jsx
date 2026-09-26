import { Badge } from "@openai/apps-sdk-ui/components/Badge";
import { Button } from "@openai/apps-sdk-ui/components/Button";

export function ProjectStatusCard({
  project,
  activeAction,
  bridgeError,
  callTool,
}) {
  const totalChanges =
    (project?.modified ?? 0) +
    (project?.added ?? 0) +
    (project?.deleted ?? 0);

  return (
    <article className="w-full max-w-sm overflow-hidden rounded-2xl border border-default bg-surface shadow-sm">
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-secondary">Project status</p>
            <h2 className="mt-0.5 truncate heading-lg">
              {project?.name ?? "ERP Apps SDK Demo"}
            </h2>
          </div>
          <Badge color={bridgeError ? "danger" : "success"} size="sm">
            {bridgeError ? "Unavailable" : "Connected"}
          </Badge>
        </div>

        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2.5 text-sm">
          <dt className="self-center font-medium text-secondary">Branch</dt>
          <dd className="text-right">
            <Badge color="secondary" variant="soft" size="sm">
              <code className="font-mono">{project?.branch ?? "—"}</code>
            </Badge>
          </dd>

          <dt className="font-medium text-secondary">Working tree</dt>
          <dd className="text-right">
            <div className="font-semibold">{totalChanges} changes</div>
            <div className="text-xs text-secondary">
              {project?.modified ?? 0} modified · {project?.added ?? 0} added
            </div>
          </dd>

          <dt className="self-center font-medium text-secondary">
            Round trip
          </dt>
          <dd className="flex items-center justify-end gap-2">
            <span className="text-xs text-secondary">
              {project?.interactionCount ?? 0} completed
            </span>
            <Button
              variant="soft"
              color="secondary"
              size="sm"
              disabled={activeAction === "run_round_trip"}
              onClick={() => callTool("run_round_trip")}
            >
              {activeAction === "run_round_trip" ? "Testing…" : "Test +1"}
            </Button>
          </dd>
        </dl>
      </div>
    </article>
  );
}
