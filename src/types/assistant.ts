export interface Task {
  id: string;
  title: string;
  completed: boolean;
  category: 'Focus' | 'Routine' | 'Wellness' | 'Home';
  time?: string;
  priority: 'high' | 'medium' | 'low';
}

export interface ScheduleEvent {
  id: string;
  title: string;
  time: string; // e.g. "09:00"
  duration: string; // e.g. "45m"
  category: 'routine' | 'focus' | 'health' | 'break';
  completed?: boolean;
  notes?: string;
}

export interface CompanionPersona {
  id: 'maya';
  name: string;
  role: string;
  tagline: string;
  idleImage: string;
  speakingImage: string;
  greeting: string;
  voicePitch: number;
  voiceRate: number;
  accentColor: string;
  description: string;
}

export interface AmbientSound {
  id: 'lofi' | 'rain' | 'forest' | 'whitenoise' | 'fireplace';
  name: string;
  category: string;
  description: string;
}

export interface WeatherData {
  temp: number;
  condition: string;
  high: number;
  low: number;
  humidity: number;
  windSpeed: number;
  city: string;
  feelsLike: number;
}
