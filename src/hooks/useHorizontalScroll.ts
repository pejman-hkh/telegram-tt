import { useEffect } from '../lib/teact/teact';

const useHorizontalScroll = (
  containerRef: React.RefObject<HTMLDivElement>,
  isDisabled?: boolean,
  shouldPreventDefault = false,
  callback?: (e: WheelEvent) => void,
  scrollContainerRef?: React.RefObject<HTMLDivElement>,
) => {
  useEffect(() => {
    if (isDisabled) {
      return undefined;
    }

    const container = containerRef.current!;

    function handleScroll(e: WheelEvent) {
      let scrollContainer = container;
      if (scrollContainerRef?.current) {
        scrollContainer = scrollContainerRef?.current;
      }
      // Ignore horizontal scroll and let it work natively (e.g. on touchpad)
      if (!e.deltaX) {
        scrollContainer.scrollLeft += e.deltaY / 4;
        if (shouldPreventDefault) e.preventDefault();
      }

      if (callback) {
        callback(e);
      }
    }

    container?.addEventListener('wheel', handleScroll, { passive: !shouldPreventDefault });

    return () => {
      container?.removeEventListener('wheel', handleScroll);
    };
  }, [containerRef, isDisabled, shouldPreventDefault, callback, scrollContainerRef]);
};

export default useHorizontalScroll;
