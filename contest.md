To implement Markdown, I tried to make editing possible in a nested way as well.
I also added Markdown support for quotes, so with the nested structure of the Markdown parser and the editor implementation, it’s easy to insert text like bold, code, etc., inside a quote.
By modifying the spoiler tag, I also allowed editing it inside the editor.

One of the challenges I faced was handling code blocks:
if Markdown like bold appears inside the code, it should not render as bold instantly — it should display the raw result instead.
However, for code blocks, I didn’t have enough time to complete the implementation for detecting and editing the code type specified on the first line.
So I commented that part out.
There wasn't an issue with my implementation, but when the cursor was placed before the code and typing started, it would jump unexpectedly.

I tried to make everything very smooth, making it easy to enter and exit tags.
To prevent breaking the TextFormatter and to avoid heavy modifications, I deselected the tag during selection and re-selected only the targeted part afterward, so there wouldn’t be conflicts with the TextFormatter.

For ESG, I also tried not to touch the CustomEmojiPicker.
However, I created a Cover component that I used in both places.
As for the GIF feature, I didn’t have enough time to implement the top navigation bar.
And honestly, I wasn’t sure exactly how it was supposed to behave.
