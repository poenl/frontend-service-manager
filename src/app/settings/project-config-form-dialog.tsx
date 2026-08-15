'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel, FieldContent, FieldError } from '@/components/ui/field'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction
} from '@/components/ui/alert-dialog'
import { projectConfigSchema, getSchemaFieldErrors } from '@/lib/service-schema'
import type { ProjectConfig } from '@/lib/config'

export type DirValues = Omit<ProjectConfig, 'id'>

interface Props {
  open: boolean
  title: string
  initial?: DirValues
  onSubmit: (values: DirValues) => Promise<void>
  onOpenChange: (open: boolean) => void
}

// 项目配置添加/编辑共用的弹窗表单：三字段 + zod 校验（touched 后标红），与详情页服务表单模式一致
export default function ProjectConfigFormDialog({
  open,
  title,
  initial,
  onSubmit,
  onOpenChange
}: Props) {
  // 初始值来自 initial（无则空表单）；父组件通过 key 在打开时重建本组件以重置
  const [values, setValues] = useState<DirValues>(() => ({
    name: initial?.name ?? '',
    path: initial?.path ?? '',
    backendEnvVar: initial?.backendEnvVar ?? ''
  }))
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)

  // schema 派生字段错误，touched 后显示
  const schemaErrors = getSchemaFieldErrors(projectConfigSchema, values)
  const fieldErrors = {
    name: touched.name ? (schemaErrors.name ?? null) : null,
    path: touched.path ? (schemaErrors.path ?? null) : null,
    backendEnvVar: touched.backendEnvVar ? (schemaErrors.backendEnvVar ?? null) : null
  }
  const canSubmit = !!(values.name.trim() && values.path.trim() && values.backendEnvVar.trim())

  const handleSubmit = async () => {
    setSaving(true)
    try {
      await onSubmit({
        name: values.name.trim(),
        path: values.path.trim(),
        backendEnvVar: values.backendEnvVar.trim()
      })
    } finally {
      setSaving(false)
    }
  }

  const setField = (key: keyof DirValues, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    setTouched((prev) => ({ ...prev, [key]: true }))
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          <Field>
            <FieldLabel>名称</FieldLabel>
            <FieldContent>
              <Input
                value={values.name}
                aria-invalid={!!fieldErrors.name || undefined}
                onChange={(e) => setField('name', e.target.value)}
                onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
                placeholder="名称"
              />
              {fieldErrors.name && <FieldError>{fieldErrors.name}</FieldError>}
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel>路径</FieldLabel>
            <FieldContent>
              <Input
                value={values.path}
                aria-invalid={!!fieldErrors.path || undefined}
                onChange={(e) => setField('path', e.target.value)}
                onBlur={() => setTouched((prev) => ({ ...prev, path: true }))}
                placeholder="/path/to/project"
              />
              {fieldErrors.path && <FieldError>{fieldErrors.path}</FieldError>}
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel>环境变量名</FieldLabel>
            <FieldContent>
              <Input
                value={values.backendEnvVar}
                aria-invalid={!!fieldErrors.backendEnvVar || undefined}
                onChange={(e) => setField('backendEnvVar', e.target.value)}
                onBlur={() => setTouched((prev) => ({ ...prev, backendEnvVar: true }))}
                placeholder="环境变量名"
                onKeyDown={(e) => e.key === 'Enter' && canSubmit && handleSubmit()}
              />
              {fieldErrors.backendEnvVar && <FieldError>{fieldErrors.backendEnvVar}</FieldError>}
            </FieldContent>
          </Field>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>取消</AlertDialogCancel>
          <AlertDialogAction onClick={handleSubmit} disabled={!canSubmit || saving}>
            保存
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
