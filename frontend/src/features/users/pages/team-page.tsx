/**
 * The team management page.
 *
 * Only administrators can reach it; the API enforces the same rule.
 */

import { Plus } from 'lucide-react'
import { useState } from 'react'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { TeamManagement } from '@/features/users/components/team-management'
import { useUsers } from '@/features/companies/hooks/use-company'

export function TeamPage() {
  const { data } = useUsers(true)
  const [addOpen, setAddOpen] = useState(false)

  return (
    <>
      <PageHeader
        title="Team"
        description="The colleagues who share your customer relationships."
        meta={
          data ? (
            <span>
              {data.meta.total} member{data.meta.total === 1 ? '' : 's'}
            </span>
          ) : null
        }
        actions={
          <Button onClick={() => setAddOpen(true)} icon={<Plus className="size-4" />}>
            Add member
          </Button>
        }
      />

      <TeamManagement
        addDialogOpen={addOpen}
        onAddDialogOpenChange={setAddOpen}
        showAddButton={false}
      />
    </>
  )
}
