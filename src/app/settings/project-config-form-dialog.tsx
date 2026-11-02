'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel, FieldContent, FieldError } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
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
import {
  PROJECT_TYPES,
  PROJECT_TYPE_LIST,
  type ProjectType,
  type ProjectTypeEnvField
} from '@/lib/project-types'
import type { ProjectConfig, ProjectConfigInput } from '@/lib/config'
import ProjectTypeIcon from '@/components/project-type-icon'

// 表单值：两种类型的变量名字段共存于同一状态，提交时按 type 只取当前类型声明的字段
type FormValues = {
  type: ProjectType
  name: string
  path: string
} & Record<ProjectTypeEnvField, string>

interface Props {
  open: boolean
  title: string
  initial?: ProjectConfig
  onSubmit: (values: ProjectConfigInput) => Promise<void>
  onOpenChange: (open: boolean) => void
}

// 项目配置添加/编辑共用的弹窗表单：类型 + 名称 + 路径 + 由类型注册表决定的变量名字段
export default function ProjectConfigFormDialog({
  open,
  title,
  initial,
  onSubmit,
  onOpenChange
}: Props) {
  // 初始值来自 initial（无则空表单）；父组件通过 key 在打开时重建本组件以重置
  const [values, setValues] = useState<FormValues>(() => ({
    type: initial?.type ?? 'vite',
    name: initial?.name ?? '',
    path: initial?.path ?? '',
    backendEnvVar: initial?.backendEnvVar ?? '',
    frontendPortEnvVar: initial?.frontendPortEnvVar ?? ''
  }))
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)

  // 当前类型声明的变量名字段（顺序即渲染顺序）
  const envFields = Object.entries(PROJECT_TYPES[values.type].envFields) as [
    ProjectTypeEnvField,
    { label: string; placeholder: string }
  ][]

  // 按当前类型组装待提交值：未声明的字段不参与校验也不提交
  const payload = {
    type: values.type,
    name: values.name.trim(),
    path: values.path.trim(),
    ...Object.fromEntries(envFields.map(([field]) => [field, (values[field] ?? '').trim()]))
  } as ProjectConfigInput

  // schema 派生字段错误，touched 后显示
  const schemaErrors = getSchemaFieldErrors(projectConfigSchema, payload)
  const fieldErrors: Record<string, string | undefined> = {
    name: touched.name ? schemaErrors.name : undefined,
    path: touched.path ? schemaErrors.path : undefined,
    ...Object.fromEntries(envFields.map(([field]) => [field, touched[field] && schemaErrors[field]]))
  }
  const canSubmit = !!(
    values.name.trim() &&
    values.path.trim() &&
    envFields.every(([field]) => (values[field] ?? '').trim())
  )

  const handleSubmit = async () => {
    setSaving(true)
    try {
      await onSubmit(payload)
    } finally {
      setSaving(false)
    }
  }

  const setField = (key: ProjectTypeEnvField | 'name' | 'path', value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    setTouched((prev) => ({ ...prev, [key]: true }))
  }

  // 切换类型时清空不属于新类型的字段，避免旧值被跨类型提交
  const setType = (type: ProjectType) => {
    const keep = Object.keys(PROJECT_TYPES[type].envFields)
    setValues((prev) => {
      const next = { ...prev, type }
      for (const field of Object.keys(prev) as (ProjectTypeEnvField | 'name' | 'path' | 'type')[]) {
        if (field !== 'type' && field !== 'name' && field !== 'path' && !keep.includes(field)) {
          next[field] = ''
        }
      }
      return next
    })
    setTouched((prev) => ({ ...prev, ...Object.fromEntries(keep.map((field) => [field, false])) }))
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          <Field>
            <FieldLabel>项目类型</FieldLabel>
            <FieldContent>
              <Select value={values.type} onValueChange={(v) => setType(v as ProjectType)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    <span className="flex items-center gap-1.5">
                      <ProjectTypeIcon type={values.type} />
                      {PROJECT_TYPES[values.type].label}
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {PROJECT_TYPE_LIST.map(([type, def]) => (
                    <SelectItem key={type} value={type}>
                      <span className="flex items-center gap-1.5">
                        <ProjectTypeIcon type={type} />
                        {def.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldContent>
          </Field>
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
          {envFields.map(([field, def]) => (
            <Field key={field}>
              <FieldLabel>{def.label}</FieldLabel>
              <FieldContent>
                <Input
                  value={values[field] ?? ''}
                  aria-invalid={!!fieldErrors[field] || undefined}
                  onChange={(e) => setField(field, e.target.value)}
                  onBlur={() => setTouched((prev) => ({ ...prev, [field]: true }))}
                  placeholder={def.placeholder}
                  onKeyDown={(e) => e.key === 'Enter' && canSubmit && handleSubmit()}
                />
                {fieldErrors[field] && <FieldError>{fieldErrors[field]}</FieldError>}
              </FieldContent>
            </Field>
          ))}
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
