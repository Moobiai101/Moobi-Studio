'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Camera, Video, ImagePlus, Headphones, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import Image from "next/image";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";

// Register ScrollTrigger plugin
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const features = [
  {
    title: 'Video Studio',
    description: 'Generate and edit videos with AI. Create stunning video content from text prompts.',
    icon: Video,
    href: '/studios/video-studio',
    color: 'text-blue-500 dark:text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    comingSoon: true,
  },
  {
    title: 'Image Studio',
    description: 'Create custom images, templates, and SVGs with powerful AI generation tools.',
    icon: Camera,
    href: '/studios/image-studio',
    color: 'text-emerald-500 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    comingSoon: false,
  },
  {
    title: 'Image Editing',
    description: 'Edit and enhance your images with AI-powered tools for professional results.',
    icon: ImagePlus,
    href: '/studios/image-editing',
    color: 'text-purple-500 dark:text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
    comingSoon: true,
  },
  {
    title: 'Dubbing Studio',
    description: 'Generate voiceovers and dub your videos with natural-sounding AI voices.',
    icon: Headphones,
    href: '/studios/dubbing-studio',
    color: 'text-amber-500 dark:text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    comingSoon: true,
  },
];

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const supabase = createClient();

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      setIsCheckingAuth(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setIsLoggedIn(!!session);
      } catch (error) {
        console.error('Error checking auth status:', error);
        setIsLoggedIn(false);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -10% 0px' }
    );
    const sections = document.querySelectorAll('.section-reveal');
    sections.forEach((section) => { observer.observe(section); });
    return () => { sections.forEach((section) => { observer.unobserve(section); }); };
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <section className="mb-20">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-sidebar-primary via-primary to-sidebar-primary animate-background-pan bg-[length:200%_auto]">
            Moobi Studio
          </h1>
          <p className="text-xl md:text-2xl font-light mb-6 bg-clip-text text-transparent bg-gradient-to-r from-sidebar-primary via-primary to-sidebar-primary animate-background-pan bg-[length:200%_auto]">
            Agentic Studio: AI at the Speed of Thought
          </p>
          <p className="text-xl text-muted-foreground mb-8">
            Create stunning videos, images, Ads, templates, and audio with the power of AI.
            Our all-in-one creative studio lets you generate professional content in minutes.
          </p>
          <div className="flex flex-wrap gap-4 justify-center mb-12">
            <Button asChild size="lg" className="gap-2 bg-sidebar-primary hover:bg-sidebar-primary/80">
              <Link href="/studios/image-studio">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-sidebar-primary/30 text-white hover:bg-sidebar-primary/10">
              <Link href="#features">
                Explore Features
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features section - simplified to ensure visibility */}
      <section id="features" className="mb-16 opacity-100">
        <div className="section-reveal">
        <h2 className="text-2xl font-bold mb-8 text-center">Creative Studios</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {features.map((feature) => (
              <Link key={feature.title} href={feature.comingSoon ? '#' : feature.href} className={cn("block group", feature.comingSoon && "cursor-not-allowed opacity-70")}>
            <Card 
                  className="relative h-full p-4 md:p-6 backdrop-blur-sm bg-card/60 border hover:border-sidebar-primary/40 hover:bg-card/80 transition-all hover:-translate-y-1 flex flex-col items-center justify-center text-center"
                >
                  {/* Conditional Coming Soon Badge */}
                  {feature.comingSoon && (
                    <div className="absolute top-2 right-2 bg-amber-500/20 text-amber-400 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-amber-500/30">
                      SOON
                    </div>
                  )}
                  <div className={`${feature.bgColor} ${feature.borderColor} w-12 h-12 rounded-lg flex items-center justify-center border mb-3 group-hover:scale-110 transition-transform`}>
                  <feature.icon className={`h-6 w-6 ${feature.color}`} />
                </div>
                  <CardTitle className="text-base md:text-lg mt-2 group-hover:text-sidebar-primary transition-colors">{feature.title}</CardTitle>
                </Card>
                  </Link>
          ))}
          </div>
        </div>
      </section>

      {/* Gallery section - simplified to ensure visibility */}
      <section id="gallery" className="mb-16 opacity-100">
        <div className="section-reveal">
          <h2 className="text-2xl font-bold mb-8 text-center">From Our Studios</h2>
          
          {/* Updated Gallery Items Data from public/gallery */}
          {(() => {
            // Mapping prompts to their URLs (or unique parts of URLs)
            const prompts: { [key: string]: string } = {
              '/gallery/images/beast-image-7.jpg': 'carry minati at the beach',
              '/gallery/images/beast-image-2.jpg': 'carry minati at the park, sitting on the bench, giving a pose for the camera',
              '/gallery/videos/e12032fc-aaae-4dac-914c-7e094f08284c.mp4': 'Anime girl with colorful umbrella sitting with a frog in the rain, night',
              '/gallery/images/model-image-1 (1).jpg': 'Salman Khan holding a red rose on a park bench, photorealistic',
              '/gallery/images/img.webp': 'Woman with pink flower in hair and sunglasses, portrait',
              '/gallery/videos/4e219ce5-c345-46f2-b779-8f819c6f6942-video.mp4': 'Blue Ferrari, front view, cinematic studio shot, headlights on',
              '/gallery/images/img (1).webp': 'Man playing chess, black and white, dramatic low-key lighting',
              '/gallery/images/img (2).webp': 'Woman in black suit, desert dunes, castle background, sunset',
              '/gallery/images/img (3).webp': 'Miniature people climbing on giant face, surreal macro',
              '/gallery/images/model-image-1 (2)-Picsart-AiImageEnhancer.jpg': 'salman khan at the beach, full wide shot',
              '/gallery/images/img (4).webp': 'Cat wearing traditional Arab clothing and glasses, city skyline view',
              '/gallery/images/img (5).webp': 'Woman with white braid in black leather trench coat, dynamic pose, studio shot',
              '/gallery/videos/bedea9c3-6c98-4ed9-93fe-98ca602682f5-video.mp4': 'Cinematic close-up of a small, fuzzy teal monster in a dark, mossy forest.',
              '/gallery/images/img (6).webp': 'Mercedes G-Wagon on alien planet landscape, planet in sky',
              '/gallery/videos/d8ed99ce-7f09-4c12-bdf6-8af929eafc71-video.mp4': 'Unicorn running on beach at sunset during a lightning storm',
              '/gallery/images/img (7).webp': 'Cute furry creature in winter clothes holding a Coca-Cola can, snow scene',
              '/gallery/images/img (8).webp': 'Woman wearing a ballgown made of pink flowers, studio photo',
              '/gallery/videos/28fa461d-8e86-430d-bb87-51b426da6b7a.mp4': 'Miniature people interacting with giant pink metallic letters spelling "CHARMS", reflective plaza.',
              '/gallery/images/img (9).webp': 'Motorcycle made of transparent clear acrylic, studio shot',
              '/gallery/images/img (10).webp': 'Graffiti-covered retro rocket ship in a desert field with flowers',
              '/gallery/images/download (7)-Picsart-AiImageEnhancer.jpeg': 'Taylor Swift in a red dress, glamour shot, red background',
              '/gallery/images/download (8)-Picsart-AiImageEnhancer.jpeg': 'Taylor Swift in a black turtleneck, bokeh portrait',
              '/gallery/images/download (9)-Picsart-AiImageEnhancer.jpeg': 'Portrait of Robert Downey Jr. as Tony Stark, stylized',
              '/gallery/images/download (10)-Picsart-AiImageEnhancer.jpeg': 'Photorealistic concept art of Robert Downey Jr as Doctor Doom, wearing armor and green hooded cloak',
              '/gallery/images/download (11)-Picsart-AiImageEnhancer.jpeg': 'taylor swift, happy face, with brown hair, blue sky with seagulls, Studio Ghibli style',
              '/gallery/images/download (12)-Picsart-AiImageEnhancer.jpeg': 'Illustration of Shah Rukh Khan waving to a crowd from a balcony, golden hour lighting',
              '/gallery/images/download (13).jpg': 'Anime illustration of Cristiano Ronaldo smiling, holding the Euro 2016 trophy, Portugal jersey',
              '/gallery/images/download (14).jpg': 'Anime illustration of Virat Kohli celebrating in Indian cricket jersey, pointing skyward'
            };

            const galleryItems = [
              // Images & Videos with updated prompts and custom trained flags
              { id: "img1", type: 'image', src: '/gallery/images/model-image-1 (2)-Picsart-AiImageEnhancer.jpg', alt: prompts['/gallery/images/model-image-1 (2)-Picsart-AiImageEnhancer.jpg'] || 'AI Generated Model 1', isCustomTrained: true, ctaLabel: 'Train Yours' },
              { id: "img2", type: 'image', src: '/gallery/images/download (7)-Picsart-AiImageEnhancer.jpeg', alt: prompts['/gallery/images/download (7)-Picsart-AiImageEnhancer.jpeg'] || 'AI Generated Art 7', isCustomTrained: true, ctaLabel: 'Train Yours' },
              { id: "vid1", type: 'video', src: '/gallery/videos/28fa461d-8e86-430d-bb87-51b426da6b7a.mp4', alt: prompts['/gallery/videos/28fa461d-8e86-430d-bb87-51b426da6b7a.mp4'] || 'AI Generated Video 1' },
              { id: "img3", type: 'image', src: '/gallery/images/download (8)-Picsart-AiImageEnhancer.jpeg', alt: prompts['/gallery/images/download (8)-Picsart-AiImageEnhancer.jpeg'] || 'AI Generated Art 8', isCustomTrained: true, ctaLabel: 'Train Yours' },
              { id: "img4", type: 'image', src: '/gallery/images/img (8).webp', alt: prompts['/gallery/images/img (8).webp'] || 'AI Generated WebP 8' },
              { id: "vid2", type: 'video', src: '/gallery/videos/bedea9c3-6c98-4ed9-93fe-98ca602682f5-video.mp4', alt: prompts['/gallery/videos/bedea9c3-6c98-4ed9-93fe-98ca602682f5-video.mp4'] || 'AI Generated Video 2' },
              { id: "img5", type: 'image', src: '/gallery/images/download (9)-Picsart-AiImageEnhancer.jpeg', alt: prompts['/gallery/images/download (9)-Picsart-AiImageEnhancer.jpeg'] || 'AI Generated Art 9', isCustomTrained: true, ctaLabel: 'Train Yours' },
              { id: "img6", type: 'image', src: '/gallery/images/download (10)-Picsart-AiImageEnhancer.jpeg', alt: prompts['/gallery/images/download (10)-Picsart-AiImageEnhancer.jpeg'] || 'AI Generated Art 10', isCustomTrained: true, ctaLabel: 'Train Yours' },
              { id: "img7", type: 'image', src: '/gallery/images/beast-image-2.jpg', alt: prompts['/gallery/images/beast-image-2.jpg'] || 'AI Generated Beast 2', isCustomTrained: true, ctaLabel: 'Train Yours' },
              { id: "vid3", type: 'video', src: '/gallery/videos/d8ed99ce-7f09-4c12-bdf6-8af929eafc71-video.mp4', alt: prompts['/gallery/videos/d8ed99ce-7f09-4c12-bdf6-8af929eafc71-video.mp4'] || 'AI Generated Video 3' },
              { id: "img8", type: 'image', src: '/gallery/images/img (6).webp', alt: prompts['/gallery/images/img (6).webp'] || 'AI Generated WebP 6' },
              { id: "img9", type: 'image', src: '/gallery/images/download (11)-Picsart-AiImageEnhancer.jpeg', alt: prompts['/gallery/images/download (11)-Picsart-AiImageEnhancer.jpeg'] || 'AI Generated Art 11', isCustomTrained: true, ctaLabel: 'Train Yours' },
              { id: "img10", type: 'image', src: '/gallery/images/download (13).jpg', alt: prompts['/gallery/images/download (13).jpg'] || 'AI Generated Art 13', isCustomTrained: true, ctaLabel: 'Train Yours' },
              { id: "vid4", type: 'video', src: '/gallery/videos/e12032fc-aaae-4dac-914c-7e094f08284c.mp4', alt: prompts['/gallery/videos/e12032fc-aaae-4dac-914c-7e094f08284c.mp4'] || 'AI Generated Video 4' },
              { id: "img11", type: 'image', src: '/gallery/images/img (1).webp', alt: prompts['/gallery/images/img (1).webp'] || 'AI Generated WebP 1' },
              { id: "img12", type: 'image', src: '/gallery/images/model-image-1 (1).jpg', alt: prompts['/gallery/images/model-image-1 (1).jpg'] || 'AI Generated Model 2', isCustomTrained: true, ctaLabel: 'Train Yours' },
              { id: "img13", type: 'image', src: '/gallery/images/download (12)-Picsart-AiImageEnhancer.jpeg', alt: prompts['/gallery/images/download (12)-Picsart-AiImageEnhancer.jpeg'] || 'AI Generated Art 12', isCustomTrained: true, ctaLabel: 'Train Yours' },
              { id: "img14", type: 'image', src: '/gallery/images/download (14).jpg', alt: prompts['/gallery/images/download (14).jpg'] || 'AI Generated Art 14', isCustomTrained: true, ctaLabel: 'Train Yours' },
              { id: "img15", type: 'image', src: '/gallery/images/img (10).webp', alt: prompts['/gallery/images/img (10).webp'] || 'AI Generated WebP 10' },
              { id: "img16", type: 'image', src: '/gallery/images/img (9).webp', alt: prompts['/gallery/images/img (9).webp'] || 'AI Generated WebP 9' },
              { id: "vid5", type: 'video', src: '/gallery/videos/4e219ce5-c345-46f2-b779-8f819c6f6942-video.mp4', alt: prompts['/gallery/videos/4e219ce5-c345-46f2-b779-8f819c6f6942-video.mp4'] || 'AI Generated Video 5' },
              { id: "img17", type: 'image', src: '/gallery/images/img (7).webp', alt: prompts['/gallery/images/img (7).webp'] || 'AI Generated WebP 7' },
              { id: "img18", type: 'image', src: '/gallery/images/img (5).webp', alt: prompts['/gallery/images/img (5).webp'] || 'AI Generated WebP 5' },
              { id: "img19", type: 'image', src: '/gallery/images/img (4).webp', alt: prompts['/gallery/images/img (4).webp'] || 'AI Generated WebP 4' },
              { id: "img20", type: 'image', src: '/gallery/images/img (3).webp', alt: prompts['/gallery/images/img (3).webp'] || 'AI Generated WebP 3' },
              { id: "img21", type: 'image', src: '/gallery/images/img (2).webp', alt: prompts['/gallery/images/img (2).webp'] || 'AI Generated WebP 2' },
              { id: "img22", type: 'image', src: '/gallery/images/img.webp', alt: prompts['/gallery/images/img.webp'] || 'AI Generated WebP Base' },
              { id: "img23", type: 'image', src: '/gallery/images/beast-image-7.jpg', alt: prompts['/gallery/images/beast-image-7.jpg'] || 'AI Generated Beast 7', isCustomTrained: true, ctaLabel: 'Train Yours' },
            ];

            return (
              <div className="relative">
                {/* Masonry Layout (similar to Image Studio) */}
                <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
                  {galleryItems.map((item) => (
                    <div key={item.id} className="overflow-hidden rounded-lg border bg-card/60 shadow-sm break-inside-avoid group relative">
                      {item.type === 'image' ? (
                        // Removed explicit aspect ratio class from container
                        <div className="bg-muted"> 
                          <Image 
                            src={item.src} 
                            alt={item.alt}
                            width={500}
                            height={500}
                            className="w-full h-auto group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      ) : (
                        // Video element added
                        <div className="bg-muted"> 
                          <video
                            src={item.src}
                            autoPlay
                            loop
                            muted
                            playsInline // Important for mobile playback
                            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      )}
                      {/* Hover Overlay with Prompt and Conditional Button */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-3 flex flex-col justify-between">
                        {/* Top section for button */}
                        <div>
                          {item.isCustomTrained && (
                            <Link href="/studios/image-studio#train" passHref className="block w-fit"> 
                              <Button 
                                variant="secondary" 
                                className="h-6 px-2 text-xs rounded-md bg-primary/80 text-primary-foreground hover:bg-primary shadow-sm"
                                onClick={(e) => e.stopPropagation()} // Prevent gallery item click
                               >
                                {item.ctaLabel || 'Train Yours'}
                              </Button>
                            </Link>
                          )}
                        </div>
                        {/* Bottom section for prompt */}
                        <p className="text-xs text-white/90 line-clamp-2 mt-auto">{item.alt}</p> 
                      </div>
                    </div>
                  ))}
                </div>

                {/* Black Fade Overlay with Login/Signup - Only show when not logged in */}
                {!isLoggedIn && !isCheckingAuth && (
                  <div className="absolute -bottom-16 left-0 right-0 h-[400px] pointer-events-none bg-gradient-to-t from-black via-black/90 to-transparent">
                    <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-center p-8 pointer-events-auto">
                      <h3 className="text-3xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-sidebar-primary via-primary to-sidebar-primary animate-background-pan bg-[length:200%_auto]">
                        Ready Set Go
                      </h3>
                      <div className="flex flex-wrap gap-4 justify-center">
                        <Button asChild size="lg" className="gap-2 min-w-[120px] bg-white text-black hover:bg-white/90">
                          <Link href="/auth?mode=login">
                            Log In
                          </Link>
                        </Button>
                        <Button asChild size="lg" className="gap-2 min-w-[120px] bg-sidebar-primary hover:bg-sidebar-primary/90">
                          <Link href="/auth?mode=signup">
                            Sign Up
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
            </div>
      </section>

    </div>
  );
}
