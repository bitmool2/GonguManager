'use client';

import { useProject, Project } from '@/contexts/ProjectContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiFetch, getEmailPrefix } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, ShoppingCart, Package, ExternalLink, Pencil } from 'lucide-react';

const statusMap: Record<string, { label: string; variant: 'success' | 'warning' | 'secondary' }> = {
  active: { label: '진행중', variant: 'success' },
  draft: { label: '준비중', variant: 'warning' },
  closed: { label: '종료', variant: 'secondary' },
};

export default function ProjectsPage() {
  const { projects, selectedProject, setSelectedProject, refreshProjects } = useProject();
  const router = useRouter();
  const emailPrefix = getEmailPrefix();

  const handleDelete = async (project: Project) => {
    if (!confirm(`"${project.name}" 프로젝트를 삭제하시겠습니까?\n관련 주문 데이터는 유지됩니다.`)) return;
    await apiFetch(`/projects/${project.id}`, { method: 'DELETE' });
    if (selectedProject?.id === project.id) setSelectedProject(null);
    await refreshProjects();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">프로젝트 관리</h1>
          <p className="text-muted-foreground">공구 캠페인을 프로젝트로 관리하세요</p>
        </div>
        <Button onClick={() => router.push('/projects/new')}>
          <Plus className="w-4 h-4 mr-2" />
          새 프로젝트
        </Button>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Package className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-1">프로젝트가 없습니다</p>
            <p className="text-muted-foreground mb-4">첫 공구 프로젝트를 만들어보세요</p>
            <Button onClick={() => router.push('/projects/new')}>
              <Plus className="w-4 h-4 mr-2" />
              새 프로젝트 만들기
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const s = statusMap[project.status] || { label: project.status, variant: 'secondary' as const };
            const isSelected = selectedProject?.id === project.id;
            return (
              <Card
                key={project.id}
                className={isSelected ? 'border-primary ring-1 ring-primary' : ''}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">{project.name}</CardTitle>
                      {project.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {project.description}
                        </p>
                      )}
                    </div>
                    <Badge variant={s.variant}>{s.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <ShoppingCart className="w-4 h-4" />
                      <span>
                        진행 {project._count?.activeOrders ?? project._count?.orders ?? 0}건
                        {(project._count?.canceledOrders ?? 0) > 0 && (
                          <span className="text-red-400 ml-1">
                            / 취소 {project._count!.canceledOrders}건
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Package className="w-4 h-4" />
                      <span>상품 {project._count?.products ?? 0}개</span>
                    </div>
                  </div>

                  {project.slug && (() => {
                    const fullSlug =
                      emailPrefix && !project.slug!.startsWith(`${emailPrefix}_`)
                        ? `${emailPrefix}_${project.slug}`
                        : project.slug;
                    return (
                      <a
                        href={`/order/${fullSlug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        /order/{fullSlug}
                      </a>
                    );
                  })()}

                  {(project.startDate || project.endDate) && (
                    <p className="text-xs text-muted-foreground">
                      {project.startDate ? project.startDate.slice(0, 10) : '?'}
                      {' ~ '}
                      {project.endDate ? project.endDate.slice(0, 10) : '?'}
                    </p>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant={isSelected ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => setSelectedProject(isSelected ? null : project)}
                    >
                      {isSelected ? '선택됨' : '선택'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => router.push(`/projects/${project.id}`)}
                      title="수정"
                    >
                      <Pencil className="w-4 h-4 text-blue-500" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(project)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
