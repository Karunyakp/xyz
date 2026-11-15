import { z } from 'zod';
export const eventSchema = z
  .object({
    title: z.string().min(3).max(180),
    description: z.string().min(20),
    category: z.string().min(1),
    event_type: z.string().min(1),
    starts_at: z.string().min(1),
    ends_at: z.string().min(1),
    registration_deadline: z.string().min(1),
    capacity: z.coerce.number().int().min(1).max(100000),
    mode: z.enum(['online', 'offline', 'hybrid']),
    timezone: z.string().min(1),
  })
  .superRefine((v, c) => {
    if (new Date(v.ends_at) <= new Date(v.starts_at))
      c.addIssue({ code: 'custom', message: 'End must be after start', path: ['ends_at'] });
    if (new Date(v.registration_deadline) > new Date(v.starts_at))
      c.addIssue({
        code: 'custom',
        message: 'Registration deadline must be before start',
        path: ['registration_deadline'],
      });
  });
export const signUpSchema = z.object({
  email: z.email(),
  password: z.string().min(12, 'Use at least 12 characters'),
  full_name: z.string().min(2),
});
