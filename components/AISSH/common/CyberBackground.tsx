import React from 'react';
import { motion } from 'framer-motion';

export const CyberBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 bg-sci-base">
      {/* Deep Space Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#11161d] via-[#050505] to-[#000000] opacity-80"></div>
      
      {/* 3D Grid Floor */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          perspective: '1000px',
          transformStyle: 'preserve-3d',
        }}
      >
        <div 
          className="absolute inset-0 w-[200%] h-[200%] -left-[50%] -top-[50%]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0, 243, 255, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 243, 255, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
            transform: 'rotateX(60deg) translateZ(-100px)',
            animation: 'grid-move 20s linear infinite',
          }}
        ></div>
      </div>

      {/* Floating Particles */}
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-sci-cyan rounded-full"
          initial={{
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            opacity: 0,
            scale: 0
          }}
          animate={{
            y: [null, Math.random() * -100],
            opacity: [0, 0.5, 0],
            scale: [0, 1.5, 0]
          }}
          transition={{
            duration: Math.random() * 5 + 5,
            repeat: Infinity,
            delay: Math.random() * 5,
            ease: "linear"
          }}
        />
      ))}

      {/* Vignette & Scanline Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)]"></div>
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,118,0.03))] bg-[length:100%_4px,3px_100%] opacity-20 pointer-events-none"></div>
      
      <style>{`
        @keyframes grid-move {
          0% { transform: rotateX(60deg) translateZ(-100px) translateY(0); }
          100% { transform: rotateX(60deg) translateZ(-100px) translateY(40px); }
        }
      `}</style>
    </div>
  );
};
