/** Why a part as a whole can't run, at the top of its fields. */
export function PartProblem({ message }: Readonly<{ message: string | undefined }>) {
  if (message === undefined) return null
  return <p className="text-label-sm font-medium text-loss">{message}</p>
}
