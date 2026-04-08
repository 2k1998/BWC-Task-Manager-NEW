'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { Button, LoadingSkeleton } from '@/components/ui';
import { createTaskComment, getTaskComments } from '@/lib/api/tasks';
import { getErrorMessage } from '@/lib/errorHandler';
import type { TaskComment } from '@/lib/types';

function formatCommentTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return format(d, 'dd MMM yyyy, HH:mm');
}

interface TaskCommentsProps {
  taskId: string;
  taskStatus: string;
}

export default function TaskComments({ taskId, taskStatus }: TaskCommentsProps) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = useCallback(async () => {
    try {
      setLoading(true);
      const list = await getTaskComments(taskId);
      setComments(list);
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (taskStatus === 'New') return;
    fetchComments();
  }, [taskStatus, fetchComments]);

  if (taskStatus === 'New') {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) {
      toast.error('Comment cannot be empty.');
      return;
    }

    setSubmitting(true);
    try {
      await createTaskComment(taskId, trimmed);
      setBody('');
      await fetchComments();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to post comment'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {loading ? (
        <LoadingSkeleton variant="table" count={3} />
      ) : comments.length === 0 ? (
        <p className="text-sm text-gray-400">No comments yet.</p>
      ) : (
        <ul className="list-none">
          {comments.map((c) => (
            <li key={c.id} className="border-b border-gray-100 pb-4 mb-4 last:border-b-0 last:pb-0 last:mb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-gray-800">{c.user_full_name}</span>
                <time className="text-xs text-gray-400" dateTime={c.created_at}>
                  {formatCommentTimestamp(c.created_at)}
                </time>
              </div>
              <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="Write a comment..."
          disabled={submitting}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 caret-gray-900 placeholder:text-gray-400 bg-white
                     focus:outline-none focus:ring-2 focus:ring-primary-gold focus:border-transparent
                     disabled:bg-gray-50 disabled:text-gray-500 resize-y min-h-[6rem]"
        />
        <div>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Posting…
              </span>
            ) : (
              'Post Comment'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
