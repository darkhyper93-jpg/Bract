import React from 'react';
import { Outlet, useMatches } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface RouteHandle {
  title?: string;
}

export function Shell() {
  const matches = useMatches();
  const currentMatch = matches[matches.length - 1];
  const title = (currentMatch?.handle as RouteHandle | undefined)?.title;

  return (
    <div className="flex h-screen overflow-hidden bg-bg-base">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header {...(title !== undefined && { title })} />
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
