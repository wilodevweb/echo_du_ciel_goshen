import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

export function AttendanceSkeleton() {
  return (
    <div className="flex flex-1 items-center">
      <Card padding="none" className="w-full rounded-lg border-gray-200 shadow-md">
        <CardContent className="p-5">
          <div className="mb-5 flex items-start gap-4">
            <Skeleton className="h-20 w-20 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-7 w-44" />
              <div className="mt-3 flex gap-2">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-24" />
              </div>
            </div>
          </div>
          <Skeleton className="mb-3 h-4 w-40" />
          <Skeleton className="mb-5 h-4 w-full" />
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
          <Skeleton className="mt-4 h-11 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
