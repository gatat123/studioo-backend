'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { format } from 'date-fns'
import { Calendar, Copy, Check, Loader2 } from 'lucide-react'
import { useProjectStore } from '@/store/useProjectStore'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

// Validation schema
const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Project name is too long'),
  type: z.enum(['illustration', 'storyboard'], {
    required_error: 'Please select a project type',
  }),
  description: z.string().max(500, 'Description is too long').optional(),
  deadline: z.string().optional(),
})

type ProjectFormData = z.infer<typeof projectSchema>

interface CreateProjectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateProjectModal({ open, onOpenChange }: CreateProjectModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>()
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null)
  const router = useRouter()
  
  const createProject = useProjectStore((state) => state.createProject)
  const generateInviteCodeAsync = useProjectStore((state) => state.generateInviteCode)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  })

  const projectType = watch('type')
  // Generate invite code
  const generateInviteCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = ''
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  // Copy invite code to clipboard
  const copyInviteCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // Handle form submission
  const onSubmit = async (data: ProjectFormData) => {
    try {
      setIsLoading(true)
      
      // Create project through API
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          tag: data.type as 'illustration' | 'storyboard',
          deadline: selectedDate ? selectedDate.toISOString() : undefined,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create project')
      }

      const newProject = await response.json()
      setCreatedProjectId(newProject.id)
      
      // Generate invite code for the created project
      if (newProject.inviteCode) {
        setInviteCode(newProject.inviteCode)
      } else {
        const code = generateInviteCode()
        setInviteCode(code)
      }
      
      // Show success state
      setShowSuccess(true)
    } catch (error) {
      console.error('Failed to create project:', error)
      // TODO: Show error notification
    } finally {
      setIsLoading(false)
    }
  }

  // Reset modal when closed
  const handleClose = () => {
    if (!isLoading) {
      onOpenChange(false)
      setTimeout(() => {
        reset()
        setShowSuccess(false)
        setInviteCode('')
        setCopied(false)
        setSelectedDate(undefined)
      }, 200)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        {!showSuccess ? (
          <>
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>
                Create a new project and invite collaborators to work together.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="grid gap-4 py-4">
                {/* Project Name */}
                <div className="grid gap-2">
                  <Label htmlFor="name">Project Name</Label>
                  <Input
                    id="name"
                    placeholder="Enter project name"
                    {...register('name')}
                    disabled={isLoading}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-500">{errors.name.message}</p>
                  )}
                </div>

                {/* Project Type */}
                <div className="grid gap-2">
                  <Label htmlFor="type">Project Type</Label>                  <Select
                    disabled={isLoading}
                    onValueChange={(value) => setValue('type', value as 'illustration' | 'storyboard')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select project type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="illustration">Illustration</SelectItem>
                      <SelectItem value="storyboard">Storyboard</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.type && (
                    <p className="text-sm text-red-500">{errors.type.message}</p>
                  )}
                </div>

                {/* Description */}
                <div className="grid gap-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Enter project description"
                    {...register('description')}
                    disabled={isLoading}
                    rows={3}
                  />
                  {errors.description && (
                    <p className="text-sm text-red-500">{errors.description.message}</p>
                  )}
                </div>
                {/* Deadline */}
                <div className="grid gap-2">
                  <Label htmlFor="deadline">Deadline (Optional)</Label>
                  <div className="relative">
                    <Input
                      id="deadline"
                      type="date"
                      disabled={isLoading}
                      onChange={(e) => {
                        const date = e.target.value ? new Date(e.target.value) : undefined
                        setSelectedDate(date)
                        setValue('deadline', e.target.value)
                      }}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isLoading ? 'Creating...' : 'Create Project'}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          /* Success State */
          <>
            <DialogHeader>
              <DialogTitle>Project Created Successfully!</DialogTitle>
              <DialogDescription>
                Your project has been created. Share the invite code below with your collaborators.
              </DialogDescription>
            </DialogHeader>
            <div className="py-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Project Name</Label>
                  <p className="font-medium">{watch('name')}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Invite Code</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 p-3 bg-muted rounded-md font-mono text-lg font-semibold text-center">
                      {inviteCode}
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={copyInviteCode}
                      className="shrink-0"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Share this code with others to invite them to your project
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => {
                if (createdProjectId) {
                  router.push(`/studio/projects/${createdProjectId}`)
                }
                handleClose()
              }} className="w-full">
                Go to Project
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}