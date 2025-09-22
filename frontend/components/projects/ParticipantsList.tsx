'use client'

import { useState } from 'react'
import { Trash2, Shield, Edit, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useProjectStore } from '@/store/useProjectStore'
import { useAuthStore } from '@/store/useAuthStore'

interface ParticipantsListProps {
  projectId: string
}

interface Participant {
  id: string
  username: string
  email: string
  role: 'owner' | 'editor' | 'viewer'
  joinedAt: string
  avatar?: string
}

export default function ParticipantsList({ projectId }: ParticipantsListProps) {
  const { toast } = useToast()
  const { user } = useAuthStore()
  const { projects, updateProjectParticipant, removeProjectParticipant } = useProjectStore()
  
  const project = projects.find(p => p.id === projectId)
  const isOwner = project?.creatorId === user?.id

  // Mock participants data
  const [participants, setParticipants] = useState<Participant[]>([
    {
      id: '1',
      username: user?.username || 'current_user',
      email: user?.email || 'user@example.com',
      role: 'owner',
      joinedAt: new Date().toISOString(),
    },
    {
      id: '2',
      username: 'jane_artist',
      email: 'jane@example.com',
      role: 'editor',
      joinedAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    },
    {
      id: '3',
      username: 'bob_reviewer',
      email: 'bob@example.com',
      role: 'viewer',
      joinedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
  ])

  const handleRoleChange = (participantId: string, newRole: string) => {
    setParticipants(prev =>
      prev.map(p =>
        p.id === participantId ? { ...p, role: newRole as Participant['role'] } : p
      )
    )
    
    toast({
      title: 'Role Updated',
      description: 'Participant role has been updated successfully.',
    })
  }

  const handleRemoveParticipant = (participantId: string) => {
    setParticipants(prev => prev.filter(p => p.id !== participantId))
    
    toast({
      title: 'Participant Removed',
      description: 'The participant has been removed from the project.',
    })
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner':
        return 'default'
      case 'editor':
        return 'secondary'
      case 'viewer':
        return 'outline'
      default:
        return 'outline'
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Shield className="h-3 w-3" />
      case 'editor':
        return <Edit className="h-3 w-3" />
      case 'viewer':
        return <User className="h-3 w-3" />
      default:
        return <User className="h-3 w-3" />
    }
  }

  const formatJoinDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              {isOwner && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {participants.map((participant) => (
              <TableRow key={participant.id}>
                <TableCell>
                  <div className="flex items-center space-x-3">
                    <Avatar>
                      <AvatarImage src={participant.avatar} />
                      <AvatarFallback>
                        {participant.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{participant.username}</p>
                      <p className="text-sm text-gray-500">{participant.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {isOwner && participant.role !== 'owner' ? (
                    <Select
                      defaultValue={participant.role}
                      onValueChange={(value) => handleRoleChange(participant.id, value)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="editor">
                          <div className="flex items-center gap-2">
                            <Edit className="h-3 w-3" />
                            Editor
                          </div>
                        </SelectItem>
                        <SelectItem value="viewer">
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3" />
                            Viewer
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant={getRoleBadgeVariant(participant.role)}>
                      <div className="flex items-center gap-1">
                        {getRoleIcon(participant.role)}
                        {participant.role}
                      </div>
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-gray-500">
                  {formatJoinDate(participant.joinedAt)}
                </TableCell>
                {isOwner && (
                  <TableCell className="text-right">
                    {participant.role !== 'owner' && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Participant</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove {participant.username} from this project?
                              They will lose access to all project resources.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRemoveParticipant(participant.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="text-sm text-gray-500">
        <p>
          <strong>Owner:</strong> Full access to all project features and settings
        </p>
        <p>
          <strong>Editor:</strong> Can edit scenes, upload images, and manage comments
        </p>
        <p>
          <strong>Viewer:</strong> Can view project content and leave comments
        </p>
      </div>
    </div>
  )
}
