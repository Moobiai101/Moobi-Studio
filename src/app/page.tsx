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

// Use Cloudflare R2 for assets (domain to be updated with your actual R2 domain)
const R2_BASE_URL = "https://pub-fa2dabd7eff54614b1563a0863fb7cbc.r2.dev";

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
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [isGalleryLoading, setIsGalleryLoading] = useState(true);
  const supabase = createClient();

  // Type for gallery items
  type GalleryItem = {
    id: string;
    type: 'image' | 'video';
    src: string;
    alt: string;
    isCustomTrained?: boolean;
    ctaLabel?: string;
  };

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

  // Fetch gallery data
  useEffect(() => {
    const fetchGalleryData = async () => {
      setIsGalleryLoading(true);
      try {
        // Mapping prompts to their URLs
        const prompts: { [key: string]: string } = {
          'beast-image-7.jpg': 'carry minati at the beach',
          'beast-image-2.jpg': 'carry minati at the park, sitting on the bench, giving a pose for the camera',
          'e12032fc-aaae-4dac-914c-7e094f08284c.mp4': 'Anime girl with colorful umbrella sitting with a frog in the rain, night',
          'model-image-1-1.jpg': 'Salman Khan holding a red rose on a park bench, photorealistic',
          'img.webp': 'Woman with pink flower in hair and sunglasses, portrait',
          '4e219ce5-c345-46f2-b779-8f819c6f6942-video.mp4': 'Blue Ferrari, front view, cinematic studio shot, headlights on',
          'img-1.webp': 'Man playing chess, black and white, dramatic low-key lighting',
          'img-2.webp': 'Woman in black suit, desert dunes, castle background, sunset',
          'img-3.webp': 'Miniature people climbing on giant face, surreal macro',
          'model-image-1-2-Picsart-AiImageEnhancer.jpg': 'salman khan at the beach, full wide shot',
          'img-4.webp': 'Cat wearing traditional Arab clothing and glasses, city skyline view',
          'img-5.webp': 'Woman with white braid in black leather trench coat, dynamic pose, studio shot',
          'bedea9c3-6c98-4ed9-93fe-98ca602682f5-video.mp4': 'Cinematic close-up of a small, fuzzy teal monster in a dark, mossy forest.',
          'img-6.webp': 'Mercedes G-Wagon on alien planet landscape, planet in sky',
          'd8ed99ce-7f09-4c12-bdf6-8af929eafc71-video.mp4': 'Unicorn running on beach at sunset during a lightning storm',
          'img-7.webp': 'Cute furry creature in winter clothes holding a Coca-Cola can, snow scene',
          'img-8.webp': 'Woman wearing a ballgown made of pink flowers, studio photo',
          '28fa461d-8e86-430d-bb87-51b426da6b7a.mp4': 'Miniature people interacting with giant pink metallic letters spelling "CHARMS", reflective plaza.',
          'img-9.webp': 'Motorcycle made of transparent clear acrylic, studio shot',
          'img-10.webp': 'Graffiti-covered retro rocket ship in a desert field with flowers',
          'download-7-Picsart-AiImageEnhancer.jpeg': 'Taylor Swift in a red dress, glamour shot, red background',
          'download-8-Picsart-AiImageEnhancer.jpeg': 'Taylor Swift in a black turtleneck, bokeh portrait',
          'download-9-Picsart-AiImageEnhancer.jpeg': 'Portrait of Robert Downey Jr. as Tony Stark, stylized',
          'download-10-Picsart-AiImageEnhancer.jpeg': 'Photorealistic concept art of Robert Downey Jr as Doctor Doom, wearing armor and green hooded cloak',
          'download-11-Picsart-AiImageEnhancer.jpeg': 'taylor swift, happy face, with brown hair, blue sky with seagulls, Studio Ghibli style',
          'download-12-Picsart-AiImageEnhancer.jpeg': 'Illustration of Shah Rukh Khan waving to a crowd from a balcony, golden hour lighting',
          'download-13.jpg': 'Anime illustration of Cristiano Ronaldo smiling, holding the Euro 2016 trophy, Portugal jersey',
          'download-14.jpg': 'Anime illustration of Virat Kohli celebrating in Indian cricket jersey, pointing skyward'
        };

        // Create gallery items using external URLs
        const items: GalleryItem[] = [
          { id: "img1", type: 'image', src: `${R2_BASE_URL}/images/model-image-1-2-Picsart-AiImageEnhancer.jpg`, alt: prompts['model-image-1-2-Picsart-AiImageEnhancer.jpg'] || 'AI Generated Model 1', isCustomTrained: true, ctaLabel: 'Train Yours' },
          { id: "img2", type: 'image', src: `${R2_BASE_URL}/images/download-7-Picsart-AiImageEnhancer.jpeg`, alt: prompts['download-7-Picsart-AiImageEnhancer.jpeg'] || 'AI Generated Art 7', isCustomTrained: true, ctaLabel: 'Train Yours' },
          { id: "vid1", type: 'video', src: `${R2_BASE_URL}/videos/28fa461d-8e86-430d-bb87-51b426da6b7a.mp4`, alt: prompts['28fa461d-8e86-430d-bb87-51b426da6b7a.mp4'] || 'AI Generated Video 1' },
          { id: "img3", type: 'image', src: `${R2_BASE_URL}/images/download-8-Picsart-AiImageEnhancer.jpeg`, alt: prompts['download-8-Picsart-AiImageEnhancer.jpeg'] || 'AI Generated Art 8', isCustomTrained: true, ctaLabel: 'Train Yours' },
          { id: "img4", type: 'image', src: `${R2_BASE_URL}/images/img-8.webp`, alt: prompts['img-8.webp'] || 'AI Generated WebP 8' },
          { id: "vid2", type: 'video', src: `${R2_BASE_URL}/videos/bedea9c3-6c98-4ed9-93fe-98ca602682f5-video.mp4`, alt: prompts['bedea9c3-6c98-4ed9-93fe-98ca602682f5-video.mp4'] || 'AI Generated Video 2' },
          { id: "img5", type: 'image', src: `${R2_BASE_URL}/images/download-9-Picsart-AiImageEnhancer.jpeg`, alt: prompts['download-9-Picsart-AiImageEnhancer.jpeg'] || 'AI Generated Art 9', isCustomTrained: true, ctaLabel: 'Train Yours' },
          { id: "img6", type: 'image', src: `${R2_BASE_URL}/images/download-10-Picsart-AiImageEnhancer.jpeg`, alt: prompts['download-10-Picsart-AiImageEnhancer.jpeg'] || 'AI Generated Art 10', isCustomTrained: true, ctaLabel: 'Train Yours' },
          { id: "img7", type: 'image', src: `${R2_BASE_URL}/images/beast-image-2.jpg`, alt: prompts['beast-image-2.jpg'] || 'AI Generated Beast 2', isCustomTrained: true, ctaLabel: 'Train Yours' },
          { id: "vid3", type: 'video', src: `${R2_BASE_URL}/videos/d8ed99ce-7f09-4c12-bdf6-8af929eafc71-video.mp4`, alt: prompts['d8ed99ce-7f09-4c12-bdf6-8af929eafc71-video.mp4'] || 'AI Generated Video 3' },
          { id: "img8", type: 'image', src: `${R2_BASE_URL}/images/img-6.webp`, alt: prompts['img-6.webp'] || 'AI Generated WebP 6' },
          { id: "img9", type: 'image', src: `${R2_BASE_URL}/images/beast-image-7.jpg`, alt: prompts['beast-image-7.jpg'] || 'AI Generated Beast 7', isCustomTrained: true, ctaLabel: 'Train Yours' },
          { id: "vid4", type: 'video', src: `${R2_BASE_URL}/videos/e12032fc-aaae-4dac-914c-7e094f08284c.mp4`, alt: prompts['e12032fc-aaae-4dac-914c-7e094f08284c.mp4'] || 'AI Generated Video 4' },
          { id: "img10", type: 'image', src: `${R2_BASE_URL}/images/model-image-1.jpg`, alt: prompts['model-image-1-1.jpg'] || 'AI Generated Model 1-1', isCustomTrained: true, ctaLabel: 'Train Yours' },
          { id: "img11", type: 'image', src: `${R2_BASE_URL}/images/img.webp`, alt: prompts['img.webp'] || 'AI Generated WebP' },
          { id: "vid5", type: 'video', src: `${R2_BASE_URL}/videos/4e219ce5-c345-46f2-b779-8f819c6f6942-video.mp4`, alt: prompts['4e219ce5-c345-46f2-b779-8f819c6f6942-video.mp4'] || 'AI Generated Video 5' },
          { id: "img12", type: 'image', src: `${R2_BASE_URL}/images/img-1.webp`, alt: prompts['img-1.webp'] || 'AI Generated WebP 1' },
          { id: "img13", type: 'image', src: `${R2_BASE_URL}/images/img-2.webp`, alt: prompts['img-2.webp'] || 'AI Generated WebP 2' },
          { id: "img14", type: 'image', src: `${R2_BASE_URL}/images/img-3.webp`, alt: prompts['img-3.webp'] || 'AI Generated WebP 3' },
          { id: "img15", type: 'image', src: `${R2_BASE_URL}/images/img-4.webp`, alt: prompts['img-4.webp'] || 'AI Generated WebP 4' },
          { id: "img16", type: 'image', src: `${R2_BASE_URL}/images/img-5.webp`, alt: prompts['img-5.webp'] || 'AI Generated WebP 5' },
          { id: "img17", type: 'image', src: `${R2_BASE_URL}/images/img-7.webp`, alt: prompts['img-7.webp'] || 'AI Generated WebP 7' },
          { id: "img18", type: 'image', src: `${R2_BASE_URL}/images/img-9.webp`, alt: prompts['img-9.webp'] || 'AI Generated WebP 9' },
          { id: "img19", type: 'image', src: `${R2_BASE_URL}/images/img-10.webp`, alt: prompts['img-10.webp'] || 'AI Generated WebP 10' },
          { id: "img20", type: 'image', src: `${R2_BASE_URL}/images/download-11-Picsart-AiImageEnhancer.jpeg`, alt: prompts['download-11-Picsart-AiImageEnhancer.jpeg'] || 'AI Generated Art 11', isCustomTrained: true, ctaLabel: 'Train Yours' },
          { id: "img21", type: 'image', src: `${R2_BASE_URL}/images/download-12-Picsart-AiImageEnhancer.jpeg`, alt: prompts['download-12-Picsart-AiImageEnhancer.jpeg'] || 'AI Generated Art 12', isCustomTrained: true, ctaLabel: 'Train Yours' },
          { id: "img22", type: 'image', src: `${R2_BASE_URL}/images/download-13.jpg`, alt: prompts['download-13.jpg'] || 'AI Generated Art 13', isCustomTrained: true, ctaLabel: 'Train Yours' },
          { id: "img23", type: 'image', src: `${R2_BASE_URL}/images/download-14.jpg`, alt: prompts['download-14.jpg'] || 'AI Generated Art 14', isCustomTrained: true, ctaLabel: 'Train Yours' }
        ];

        setGalleryItems(items);
      } catch (error) {
        console.error('Error fetching gallery data:', error);
      } finally {
        setIsGalleryLoading(false);
      }
    };

    fetchGalleryData();
  }, []);

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

      {/* Gallery section - loading items dynamically from external CDN */}
      <section id="gallery" className="mb-16 opacity-100">
        <div className="section-reveal">
          <h2 className="text-2xl font-bold mb-8 text-center">From Our Studios</h2>
          
          <div className="relative">
            {isGalleryLoading ? (
              <div className="text-center py-20">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" role="status">
                  <span className="sr-only">Loading...</span>
                </div>
                <p className="mt-4 text-muted-foreground">Loading gallery...</p>
              </div>
            ) : (
              <>
                {/* Masonry Layout with externally loaded images */}
                <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
                  {galleryItems.map((item) => (
                    <div key={item.id} className="overflow-hidden rounded-lg border bg-card/60 shadow-sm break-inside-avoid group relative">
                      {item.type === 'image' ? (
                        <div className="bg-muted"> 
                          <Image 
                            src={item.src}
                            alt={item.alt}
                            width={500}
                            height={500}
                            className="w-full h-auto group-hover:scale-105 transition-transform duration-300"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className="bg-muted"> 
                          <video
                            src={item.src}
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      )}
                      {/* Hover Overlay with Prompt and Conditional Button */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-3 flex flex-col justify-between">
                        <div>
                          {item.isCustomTrained && (
                            <Link href="/studios/image-studio#train" passHref className="block w-fit"> 
                              <Button 
                                variant="secondary" 
                                className="h-6 px-2 text-xs rounded-md bg-primary/80 text-primary-foreground hover:bg-primary shadow-sm"
                                onClick={(e) => e.stopPropagation()} 
                              >
                                {item.ctaLabel || 'Train Yours'}
                              </Button>
                            </Link>
                          )}
                        </div>
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
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
