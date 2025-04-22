import { Construction } from 'lucide-react';

interface ComingSoonProps {
  title: string;
  description?: string;
}

export default function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
      <Construction className="h-16 w-16 text-primary mb-6 animate-bounce" />
      <h1 className="text-3xl font-bold mb-4">{title} - Coming Soon!</h1>
      <p className="text-lg text-muted-foreground max-w-md">
        {description || 'We are working hard to bring this feature to you. Check back soon!'}
      </p>
    </div>
  );
} 