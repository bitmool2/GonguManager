'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

export interface Project {
  id: number;
  name: string;
  description?: string;
  status: string;
  slug?: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  _count?: { orders: number; products: number; activeOrders: number; canceledOrders: number };
}

interface ProjectContextType {
  projects: Project[];
  selectedProject: Project | null;
  setSelectedProject: (project: Project | null) => void;
  refreshProjects: () => Promise<void>;
  loading: boolean;
}

const ProjectContext = createContext<ProjectContextType>({
  projects: [],
  selectedProject: null,
  setSelectedProject: () => {},
  refreshProjects: async () => {},
  loading: false,
});

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProjectState] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshProjects = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Project[]>('/projects');
      setProjects(data);

      // 저장된 프로젝트 ID 복원
      const savedId = localStorage.getItem('selectedProjectId');
      if (savedId) {
        const found = data.find((p) => p.id === Number(savedId));
        if (found) setSelectedProjectState(found);
        else if (data.length > 0) setSelectedProjectState(data[0]);
      } else if (data.length > 0) {
        setSelectedProjectState(data[0]);
      }
    } catch {
      // 비로그인 상태 등 무시
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  const setSelectedProject = (project: Project | null) => {
    setSelectedProjectState(project);
    if (project) {
      localStorage.setItem('selectedProjectId', String(project.id));
    } else {
      localStorage.removeItem('selectedProjectId');
    }
  };

  return (
    <ProjectContext.Provider
      value={{ projects, selectedProject, setSelectedProject, refreshProjects, loading }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  return useContext(ProjectContext);
}
