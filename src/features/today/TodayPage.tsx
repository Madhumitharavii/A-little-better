import { useState } from 'react';
import { useTodayCare } from './useTodayCare';
import { useCareDay } from './useCareDay';
import { addDays } from '@/db/dateUtils';
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
import { logStudySession } from '@/db/repositories/studyRepository';

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
  // Care for Me can also be ticked for yesterday (done just before midnight, ticked just after).
  const yesterday = addDays(date, -1);
  const [careDate, setCareDate] = useState<string | null>(null);
  const onYesterday = careDate === yesterday;
  const yesterdayCare = useCareDay(yesterday);
  const care = onYesterday ? yesterdayCare : { findEntry, toggleDone, addMinutes, markSkipped };

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
    // One column on phones; two from tablet width; on a wide window, three columns:
    //   greeting · thought
    //   today's focus
    //   Care for Me · Care Around Me · Noticed + This Evening
    //   toolbox
    // (The order on the page is unchanged, so phones read top to bottom as before.)
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 xl:grid-rows-[auto_auto_auto_1fr_auto] gap-6 sm:gap-8 xl:gap-6 items-start">
      <div className="md:col-span-2 xl:col-span-8 xl:row-start-1 xl:h-full xl:[&>*]:h-full">
        <GreetingHeader
          date={date}
          streaks={streaks}
          onOpenBored={() => openTool('bored')}
          onOpenScrolling={() => openTool('scrolling')}
        />
      </div>

      <div className="md:col-span-2 xl:col-span-4 xl:row-start-1 xl:h-full xl:[&>*]:h-full xl:[&>*]:flex xl:[&>*]:flex-col xl:[&>*]:justify-center">
        <ThoughtOfTheDayCard />
      </div>

      <div className="md:col-span-2 xl:col-span-12 xl:row-start-2">
        <TodayFocusBanner
          myselfDone={findEntry('bathed')?.status === 'done' || findEntry('ateFruit')?.status === 'done'}
          spaceDone={findEntry('spaceReset')?.status === 'done'}
          peopleDone={findEntry('messageReset')?.status === 'done' || findEntry('relationshipCheck')?.status === 'done'}
        />
      </div>

      <div className="xl:col-span-4 xl:col-start-1 xl:row-start-3 xl:row-span-2">
        <CareForMeSection
          day={onYesterday ? 'yesterday' : 'today'}
          onDayChange={(d) => setCareDate(d === 'yesterday' ? yesterday : null)}
          findEntry={(key) => care.findEntry(key as CareItemKey)}
          onToggleDone={(key) => {
            if (!care.toggleDone(key as CareItemKey)) {
              showToast(`Your minutes stay logged for ${onYesterday ? 'yesterday' : 'today'}, so this stays ticked.`);
              return;
            }
            chime();
          }}
          onRequestSkip={(key) => setSkipTarget(key as CareItemKey)}
          onAddReadingMinutes={(mins) => {
            care.addMinutes('reading', mins);
            chime();
          }}
          onOpenFocusTimer={() => openTool('focusTimer')}
          showToast={showToast}
        />
      </div>

      <div className="xl:col-span-4 xl:col-start-5 xl:row-start-3 xl:row-span-2">
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
      <div className="md:col-span-2 xl:col-span-4 xl:col-start-9 xl:row-start-3">
        <AdvisorCard />
      </div>

      {/* Folded by default — see ToolboxGrid. Sits after the daily care
          so the everyday checklist comes first. */}
      <div className="md:col-span-2 xl:col-span-12 xl:row-start-5">
        <ToolboxGrid openTool={openTool} />
      </div>

      <div className="md:col-span-2 xl:col-span-4 xl:col-start-9 xl:row-start-4">
        <EveningReflectionCard
          gratitude={reflection?.gratitude ?? ''}
          smallWin={reflection?.smallWin ?? ''}
          onChange={(field, value) => saveReflectionField(field, value)}
          eveningDone={!!reflection?.eveningDone}
          onOpenEvening={() => openTool('evening')}
        />
      </div>

      {/* Skip reason */}
      {skipTarget && (
        <SkipReasonModal
          onClose={() => setSkipTarget(null)}
          onConfirm={(reason) => {
            care.markSkipped(skipTarget, reason);
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
          onComplete={async (mins, focusFor) => {
            addMinutes('focus', mins);
            if (focusFor) await logStudySession({ subject: focusFor.subject, topicId: focusFor.topicId, minutes: mins, fromFocus: true });
            chime();
            showToast(
              focusFor
                ? `Focused for ${mins} min${mins === 1 ? '' : 's'} on ${focusFor.subject.title}. Logged to your study log ✨`
                : `Focused for ${mins} min${mins === 1 ? '' : 's'}. Beautiful job starting!`,
            );
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
