import { useQuery } from '@tanstack/react-query';
import { storageService } from '../services';
export function SecureImage({
  path,
  bucket = 'branding',
  alt,
  className,
}: {
  path: string;
  bucket?: string;
  alt: string;
  className?: string;
}) {
  const q = useQuery({
    queryKey: ['image', bucket, path],
    queryFn: () => storageService.url(path, bucket),
    staleTime: 600000,
    retry: 1,
  });
  return q.data ? (
    <img className={className} src={q.data} alt={alt} />
  ) : (
    <span aria-label={alt} className={className}>
      {alt.slice(0, 1)}
    </span>
  );
}
