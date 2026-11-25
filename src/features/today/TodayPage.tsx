import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { breakfastNudge, LOOK_BACK_DAYS, type MealKey, type MealState } from './meals';
import LetterOpenBanner from '@/features/letters/LetterOpenBanner';
import { useLetters } from '@/features/letters/useLetters';
import { unreadOpen } from '@/features/letters/letters';
import OnThisDayCard from '@/features/memories/OnThisDayCard';
import YearReviewCard from '@/features/review/YearReviewCard';
import BadDayView from './BadDayView';
import WriteLetterModal from '@/features/letters/WriteLetterModal';
import { longDate } from '@/features/letters/letters';
import MealsRow from './MealsRow';
import { useBadDay } from './badDay';
import { useTodayCare } from './useTodayCare';
import { useCareDay } from './useCareDay';
import { addDays } from '@/db/dateUtils';
import { useStreaks } from './useStreaks';
import { playSoftChime } from '@/shared/utils/sound';
import type { ToolId } from '@/features/toolbox/types';

import GreetingHeader from './GreetingHeader';
import ThoughtOfTheDayCard from './ThoughtOfTheDayCard';
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
  const { date, careEntries, reflection, findEntry, markDone, markSkipped, toggleDone, addMinutes, clear, saveReflectionField, saveEveningNotes } =
    useTodayCare();
  const streaks = useStreaks();
  // Care for Me can also be ticked for yesterday (done just before midnight, ticked just after).
  const yesterday = addDays(date, -1);
  const [careDate, setCareDate] = useState<string | null>(null);
  const onYesterday = careDate === yesterday;
  const yesterdayCare = useCareDay(yesterday);
  const care = onYesterday ? yesterdayCare : { findEntry, toggleDone, addMinutes, markSkipped, markDone, clear };

  // The past week's meals, for the "health before everything" breakfast nudge.
  const recentCare = useLiveQuery(() => db.careEntries.where('date').between(addDays(date, -LOOK_BACK_DAYS), date).toArray(), [date]);
  const nudge = recentCare ? breakfastNudge(recentCare, date) : null;
  const setMeal = (key: MealKey, state: MealState) => {
    if (state === 'ate') {
      void care.markDone(key);
      chime();
    } else if (state === 'skipped') void care.markSkipped(key, 'skipped');
    else void care.clear(key);
  };

  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const [skipTarget, setSkipTarget] = useState<CareItemKey | null>(null);

  const openTool = (tool: ToolId) => {
    // The advisor notices patterns in these two (kept on this device only).
    if (tool === 'bored' || tool === 'scrolling') void recordToolEvent(tool);
    setActiveTool(tool);
  };
  const closeTool = () => setActiveTool(null);

  const chime = (type: 'gentle' | 'complete' = 'complete') => playSoftChime(soundEnabled, type);
  const [badDay, setBadDay] = useBadDay(date);
  const [writingLetter, setWritingLetter] = useState(false);
  // Banners between the top and the cards — only when there's something to say.
  const letterWaiting = unreadOpen(useLetters(), date).length > 0;
  const now = new Date();
  const reviewJustOpened = now.getMonth() === 0 && now.getDate() <= 15;
  const banners = letterWaiting || reviewJustOpened;

  const evening = (
    <EveningReflectionCard
      gratitude={reflection?.gratitude ?? ''}
      smallWin={reflection?.smallWin ?? ''}
      onChange={(field, value) => saveReflectionField(field, value)}
      eveningDone={!!reflection?.eveningDone}
      onOpenEvening={() => openTool('evening')}
      onWriteLetter={() => setWritingLetter(true)}
    />
  );

  const page = badDay ? (
    <BadDayView
      meals={
        <MealsRow
          findEntry={(k) => findEntry(k)}
          onSet={(k, st) => {
            if (st === 'ate') {
              void markDone(k);
              chime();
            } else if (st === 'skipped') void markSkipped(k, 'skipped');
            else void clear(k);
          }}
          nudge={null}
        />
      }
      evening={evening}
      onEnd={() => setBadDay(false)}
    />
  ) : (
    // Phones read top to bottom: greeting, thought, any banners, Care for Me (meals first),
    // This Evening, Care Around Me, the reset tools, and On this day last.
    // On a wide window: greeting + thought | This Evening, then Care for Me | Care Around Me,
    // then the reset tools, then On this day.
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-6 sm:gap-8 xl:gap-6 items-start">
      {/* Wide screens: the greeting and today's thought stack on the left, level with This Evening on the right. */}
      <div className="md:col-span-2 xl:col-span-8 xl:row-start-1 xl:h-full xl:flex xl:flex-col xl:gap-6">
        <GreetingHeader
          date={date}
          streaks={streaks}
          onOpenBored={() => openTool('bored')}
          onOpenScrolling={() => openTool('scrolling')}
          onBadDay={() => setBadDay(true)}
        />
        <ThoughtOfTheDayCard className="hidden xl:flex xl:flex-1 xl:flex-col xl:justify-center" />
      </div>

      {/* Phones and tablets: the thought right under the greeting. */}
      <div className="md:col-span-2 xl:hidden">
        <ThoughtOfTheDayCard />
      </div>

      {/* Only there when there's something to say (a letter opened, last year's review is ready). */}
      {banners && (
        <div className="md:col-span-2 xl:col-span-12 xl:row-start-2 space-y-4">
          <LetterOpenBanner />
          <YearReviewCard justOpened />
        </div>
      )}

      <div className={`xl:col-span-6 xl:col-start-1 ${banners ? 'xl:row-start-3' : 'xl:row-start-2'}`}>
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
          onSetMeal={setMeal}
          breakfastNudge={nudge}
        />
      </div>

      <div className="xl:col-span-4 xl:col-start-9 xl:row-start-1 xl:h-full xl:[&>*]:h-full">{evening}</div>

      <div className={`md:col-span-2 xl:col-span-6 xl:col-start-7 ${banners ? 'xl:row-start-3' : 'xl:row-start-2'}`}>
        <AroundMeCard
          spaceDone={findEntry('spaceReset')?.status === 'done'}
          messagesDone={findEntry('messageReset')?.status === 'done'}
          peopleDone={findEntry('relationshipCheck')?.status === 'done'}
          onOpenSpace={() => openTool('roomReset')}
          onOpenMessages={() => openTool('messageReset')}
          onOpenPeople={() => openTool('relationshipConnection')}
        />
      </div>

      {/* Folded by default — see ToolboxGrid. */}
      <div className={`md:col-span-2 xl:col-span-12 ${banners ? 'xl:row-start-4' : 'xl:row-start-3'}`}>
        <ToolboxGrid openTool={openTool} />
      </div>

      {/* Looking back comes last. */}
      <div className={`md:col-span-2 xl:col-span-12 ${banners ? 'xl:row-start-5' : 'xl:row-start-4'} empty:hidden`}>
        <OnThisDayCard today={date} />
      </div>
    </div>
  );

  return (
    <>
      {page}

      {writingLetter && (
        <WriteLetterModal
          onClose={() => setWritingLetter(false)}
          onSealed={(openOn) => {
            setWritingLetter(false);
            showToast(`Sealed 🔒 It opens ${longDate(openOn)}. You'll find it in Journal.`);
          }}
        />
      )}

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
      {activeTool === 'scrolling' && <ScrollingTool date={date} onClose={closeTool} showToast={showToast} openTool={openTool} />}

      {/* Reflection tools */}
      {activeTool === 'procrastination' && <ProcrastinationTool date={date} onClose={closeTool} showToast={showToast} openTool={openTool} />}
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
            if (focusFor)
              await logStudySession({
                subject: focusFor.subject,
                topicId: focusFor.topicId,
                minutes: mins,
                fromFocus: true,
              });
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
    </>
  );
}
