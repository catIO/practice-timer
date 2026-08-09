import { PlanEditorPane, PlanEditorPaneProps } from "./PlanEditorPane";
import { practicePlanApi, getSnapshots, saveSnapshot } from "@/lib/practicePlan";

export function PracticePlanPane(
  props: Omit<PlanEditorPaneProps, "planTitle" | "planType" | "planApi" | "getSnapshots" | "saveSnapshot">
) {
  return (
    <PlanEditorPane
      {...props}
      planTitle="Practice Plan"
      planType="practice"
      planApi={practicePlanApi}
      getSnapshots={getSnapshots}
      saveSnapshot={saveSnapshot}
    />
  );
}
