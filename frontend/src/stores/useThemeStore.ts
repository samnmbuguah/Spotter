import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      toggleTheme: () => {
        const newTheme = get().theme === 'light' ? 'dark' : 'light';
        document.documentElement.classList.toggle('dark', newTheme === 'dark');
        set({ theme: newTheme });
      },
      setTheme: (theme: Theme) => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        set({ theme });
      },
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => localStorage),
      // Only persist the theme preference
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);

// Initialize theme on load
const savedTheme = localStorage.getItem('theme-storage');
if (savedTheme) {
  const { state } = JSON.parse(savedTheme);
  document.documentElement.classList.toggle('dark', state.theme === 'dark');
}
