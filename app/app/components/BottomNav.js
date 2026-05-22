'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MicIcon, WalletIcon, BellIcon, ChartIcon } from './Icons';

const navItems = [
  { href: '/', icon: MicIcon, label: 'Voice' },
  { href: '/loans', icon: WalletIcon, label: 'Loans' },
  { href: '/alerts', icon: BellIcon, label: 'Alerts' },
  { href: '/reports', icon: ChartIcon, label: 'Reports' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav" id="bottom-nav">
      {navItems.map(({ href, icon: Icon, label }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`nav-item ${isActive ? 'active' : ''}`}
            id={`nav-${label.toLowerCase()}`}
          >
            <Icon size={26} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
