// Consistent user feedback for failed actions: plan-limit refusals become a friendly warning with
// the actual limit; anything else is logged and shown as a generic, non-technical error.
import { toast } from "sonner";
import { asPlanLimitError, limitOf, useEntitlements } from "@/features/subscriptions";

export const reportActionError = (error: unknown, fallbackMessage: string) => {
  const planLimit = asPlanLimitError(error);
  if (planLimit) {
    const entitlements = useEntitlements.getState().entitlements;
    const limit = entitlements ? limitOf(entitlements, planLimit.limitKey) : null;
    toast.warning(planLimit.friendlyMessage(limit), { description: planLimit.hint() });
    return;
  }

  console.error(fallbackMessage, error);
  toast.error(fallbackMessage);
};

/** Runs an async UI action, routing any failure through `reportActionError`. */
export const runAction = async (action: () => Promise<void>, fallbackMessage: string) => {
  try {
    await action();
  } catch (error) {
    reportActionError(error, fallbackMessage);
  }
};
