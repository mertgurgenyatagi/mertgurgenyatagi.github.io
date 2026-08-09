/** The one gate string, centralised. The parent duplicated this literal across
 *  six files before it was pulled into a component. */
export const PAGE_UNAVAILABLE_MESSAGE = "You need to be signed in to see this.";

export function PageUnavailable() {
  return (
    <div className="flex h-full flex-1 items-center px-5 sm:px-8 lg:px-12">
      <p className="font-display text-2xl text-color_textsecondary italic">
        {PAGE_UNAVAILABLE_MESSAGE}
      </p>
    </div>
  );
}
