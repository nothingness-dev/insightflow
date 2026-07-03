import { useCallback, useEffect, useState } from 'react';
import { adminUserApi } from '../../../api/endpoints';
import type { PaginatedResponse, User } from '../../../types';
import { getErrorMessage } from '../../../utils/helpers';
import { isCanceledRequest } from '../../../utils/http';

export const USERS_PER_PAGE = 50;

export function useUserDirectory() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError('');

    const params: Record<string, string> = {
      page: String(page),
      page_size: String(USERS_PER_PAGE),
    };
    if (search.trim()) params.search = search.trim();
    if (roleFilter) params.role = roleFilter;

    try {
      const response = await adminUserApi.list(params, signal);
      const payload = response.data as PaginatedResponse<User>;
      setUsers(payload.results || []);
      setTotalUsers(payload.count || 0);
    } catch (error) {
      if (isCanceledRequest(error, signal)) return;
      setUsers([]);
      setTotalUsers(0);
      setLoadError(getErrorMessage(error));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [page, search, roleFilter]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const refreshFirstPage = () => {
    if (page === 1) {
      void load();
    } else {
      setPage(1);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleRoleChange = (value: string) => {
    setRoleFilter(value);
    setPage(1);
  };

  return {
    users,
    setUsers,
    loading,
    loadError,
    search,
    roleFilter,
    page,
    setPage,
    totalUsers,
    load,
    refreshFirstPage,
    handleSearchChange,
    handleRoleChange,
  };
}
