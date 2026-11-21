import { useState } from 'react';
import { useTodayCare } from './useTodayCare';
import { useStreaks } from './useStreaks';
import { playSoftChime } from '@/shared/utils/sound';
import type { ToolId } from '@/features/toolbox/types';

import GreetingHeader from './GreetingHeader';
import TodayFocusBanner from './TodayFocusBanner';
import ThoughtOfTheDayCard from './ThoughtOfTheDayCard';
import AdvisorCard from '@/features/advisor/AdvisorCard';
import CareForMeSection from './CareForMeSection';
import AroundMeCard from './StatusCards';
import EveningReflectionCard from './EveningReflectionCard';
import SkipReasonModal from './SkipReasonModal';

import ToolboxGrid from '@/features/toolbox/ToolboxGrid';
import BoredTool from '@/features/toolbox/tools/BoredTool';
import ScrollingTool from '@/features/toolbox/tools/ScrollingTool';
import ProcrastinationTool from '@/features/toolbox/tools/ProcrastinationTool';
import OverthinkingTool from '@/features/toolbox/tools/OverthinkingTool';
import TemperTool from '@/features/toolbox/tools/TemperTool';
import SelfDoubtTool from '@/features/toolbox/tools/SelfDoubtTool';
import AppearanceTool from '@/features/toolbox/tools/AppearanceTool';
import RoomResetTimerTool from '@/features/toolbox/tools/RoomResetTimerTool';
import FocusTimerTool from '@/features/toolbox/tools/FocusTimerTool';
import MessageResetTool from '@/features/toolbox/tools/MessageResetTool';
import RelationshipConnectionTool from '@/features/toolbox/tools/RelationshipConnectionTool';
import EveningModeTool from '@/features/toolbox/tools/EveningModeTool';
import type { CareItemKey } from '@/db/schema';
import { recordToolEvent } from '@/db/repositories/toolEventRepository';

interface TodayPageProps {
  showToast: (msg: string) => void;
  soundEnabled: boolean;
}

export default function TodayPage({ showToast, soundEnabled }: TodayPageProps) {
  const {
    date,
    careEntries,
    reflection,
    findEntry,
    markDone,
    markSkipped,
    toggleDone,
    addMinutes,
    saveReflectionField,
    saveEveningNotes,
  } = useTodayCare();
  const streaks = useStreaks();

  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const [skipTarget, setSkipTarget] = useState<CareItemKey | null>(null);

  const openTool = (tool: ToolId) => {
    // The advisor notices patterns in these two (kept on this device only).
    if (tool === 'bored' || tool === 'scrolling') void recordToolEvent(tool);
    setActiveTool(tool);
  };
  const closeTool = () => setActiveTool(null);

  const chime = (type: 'gentle' | 'complete' = 'complete') => playSoftChime(soundEnabled, type);

  return (
    <div className="space-y-6 sm:space-y-8">
      <GreetingHeader
        date={date}
        streaks={streaks}
        onOpenBored={() => openTool('bored')}
        onOpenScrolling={() => openTool('scrolling')}
      />

      <ThoughtOfTheDayCard />

      <TodayFocusBanner
        myselfDone={findEntry('bathed')?.status === 'done' || findEntry('ateFruit')?.status === 'done'}
        spaceDone={findEntry('spaceReset')?.status === 'done'}
        peopleDone={findEntry('messageReset')?.status === 'done' || findEntry('relationshipCheck')?.status === 'done'}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 items-start">
        <CareForMeSection
          findEntry={(key) => findEntry(key as CareItemKey)}
          onToggleDone={(key) => {
            toggleDone(key as CareItemKey);
            chime();
          }}
          onRequestSkip={(key) => setSkipTarget(key as CareItemKey)}
          onAddReadingMinutes={(mins) => {
            addMinutes('reading', mins);
            chime();
          }}
          onOpenFocusTimer={() => openTool('focusTimer')}
        />

        <AroundMeCard
          spaceDone={findEntry('spaceReset')?.status === 'done'}
          messagesDone={findEntry('messageReset')?.status === 'done'}
          peopleDone={findEntry('relationshipCheck')?.status === 'done'}
          onOpenSpace={() => openTool('roomReset')}
          onOpenMessages={() => openTool('messageReset')}
          onOpenPeople={() => openTool('relationshipConnection')}
        />
      </div>

      {/* Gentle advice from what's been logged — worked out on-device. */}
      <AdvisorCard />

      {/* Folded by default — see ToolboxGrid. Sits after the daily care
          so the everyday checklist comes first. */}
      <ToolboxGrid openTool={openTool} />

      <EveningReflectionCard
        gratitude={reflection?.gratitude ?? ''}
        smallWin={reflection?.smallWin ?? ''}
        onChange={(field, value) => saveReflectionField(field, value)}
        eveningDone={!!reflection?.eveningDone}
        onOpenEvening={() => openTool('evening')}
      />

      {/* Skip reason */}
      {skipTarget && (
        <SkipReasonModal
          onClose={() => setSkipTarget(null)}
          onConfirm={(reason) => {
            markSkipped(skipTarget, reason);
            setSkipTarget(null);
          }}
        />
      )}

      {/* Mindful-redirect tools */}
      {activeTool === 'bored' && <BoredTool date={date} onClose={closeTool} showToast={showToast} openTool={openTool} />}
      {activeTool === 'scrolling' && (
        <ScrollingTool date={date} onClose={closeTool} showToast={showToast} openTool={openTool} />
      )}

      {/* Reflection tools */}
      {activeTool === 'procrastination' && (
        <ProcrastinationTool date={date} onClose={closeTool} showToast={showToast} openTool={openTool} />
      )}
      {activeTool === 'overthinking' && <OverthinkingTool date={date} onClose={closeTool} showToast={showToast} />}
      {activeTool === 'temper' && <TemperTool date={date} onClose={closeTool} showToast={showToast} />}
      {activeTool === 'selfDoubt' && <SelfDoubtTool date={date} onClose={closeTool} showToast={showToast} />}
      {activeTool === 'appearance' && <AppearanceTool date={date} onClose={closeTool} showToast={showToast} />}

      {/* Utility tools tied to specific care items */}
      {activeTool === 'roomReset' && (
        <RoomResetTimerTool
          onClose={closeTool}
          onComplete={() => {
            markDone('spaceReset');
            chime();
            showToast('Room reset complete! Your space breathes again.');
            closeTool();
          }}
        />
      )}
      {activeTool === 'focusTimer' && (
        <FocusTimerTool
          onClose={closeTool}
          onComplete={(mins) => {
            addMinutes('focus', mins);
            chime();
            showToast(`Focused for ${mins} mins. Beautiful job starting!`);
            closeTool();
          }}
        />
      )}
      {activeTool === 'messageReset' && (
        <MessageResetTool
          onClose={closeTool}
          onComplete={() => {
            markDone('messageReset');
            chime();
            showToast('Nightly messages checked & mind at ease.');
            closeTool();
          }}
        />
      )}
      {activeTool === 'relationshipConnection' && (
        <RelationshipConnectionTool
          onClose={closeTool}
          onConnected={() => {
            if (findEntry('relationshipCheck')?.status !== 'done') {
              markDone('relationshipCheck');
              chime();
            }
          }}
          onComplete={() => {
            markDone('relationshipCheck');
            chime();
            showToast('Relationship connection logged!');
            closeTool();
          }}
        />
      )}
      {activeTool === 'evening' && (
        <EveningModeTool
          initialNotes={{
            goodThing: reflection?.eveningGoodThing ?? '',
            leaveTomorrow: reflection?.eveningLeaveForTomorrow ?? '',
            mood: reflection?.eveningMood ?? '',
          }}
          todaysCare={careEntries}
          onClose={closeTool}
          onSave={(notes) => {
            saveEveningNotes(notes);
            chime();
            showToast('Evening rest logged. Sweet dreams 🌙');
            closeTool();
          }}
        />
      )}
    </div>
  );
}
