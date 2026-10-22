/**
 * The 404 page.
 */

import { Compass } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/feedback/state'

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <EmptyState
          icon={Compass}
          title="This page does not exist"
          description="The link may be out of date, or the record may have been deleted."
          action={
            <Button asChild>
              <Link to="/dashboard">Back to the dashboard</Link>
            </Button>
          }
        />
      </div>
    </div>
  )
}
