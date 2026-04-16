import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import landingBody from './landing-body.html?raw';
import './landing.css';

export default function LandingPage() {
  const rootRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    document.body.classList.add('landing-active');
    return () => document.body.classList.remove('landing-active');
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onClick = (e) => {
      const a = e.target.closest('a[href]');
      if (!a || !root.contains(a)) return;
      const href = a.getAttribute('href');
      if (!href) return;

      if (href.startsWith('#')) {
        if (href === '#') {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return;
      }

      if (href.startsWith('/') && !href.startsWith('//')) {
        e.preventDefault();
        navigate(href);
      }
    };

    root.addEventListener('click', onClick);

    const nav = root.querySelector('.nav');
    const onScroll = () => {
      if (nav) nav.classList.toggle('scrolled', window.scrollY > 50);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    const toggle = root.querySelector('.nav-toggle');
    const menu = root.querySelector('.mobile-menu');

    const toggleHandler = () => {
      if (!toggle || !menu) return;
      const isOpen = menu.classList.contains('active');
      menu.classList.toggle('active');
      document.body.style.overflow = isOpen ? '' : 'hidden';
      const spans = toggle.querySelectorAll('span');
      if (!isOpen) {
        spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
        spans[1].style.opacity = '0';
        spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
      } else {
        spans[0].style.transform = '';
        spans[1].style.opacity = '';
        spans[2].style.transform = '';
      }
    };

    if (toggle) toggle.addEventListener('click', toggleHandler);

    const closeMenu = () => {
      if (!toggle || !menu) return;
      menu.classList.remove('active');
      document.body.style.overflow = '';
      const spans = toggle.querySelectorAll('span');
      spans[0].style.transform = '';
      spans[1].style.opacity = '';
      spans[2].style.transform = '';
    };

    if (menu) {
      menu.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', closeMenu);
      });
    }

    const elements = root.querySelectorAll('.reveal, .stagger-children');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );
    elements.forEach((el) => observer.observe(el));

    return () => {
      root.removeEventListener('click', onClick);
      window.removeEventListener('scroll', onScroll);
      if (toggle) toggle.removeEventListener('click', toggleHandler);
      observer.disconnect();
      document.body.style.overflow = '';
    };
  }, [navigate]);

  return (
    <div
      ref={rootRef}
      className="landing-root"
      dangerouslySetInnerHTML={{ __html: landingBody }}
    />
  );
}
