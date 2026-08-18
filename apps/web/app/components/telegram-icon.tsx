type TelegramIconProps = {
  readonly size?: number
}

export function TelegramIcon({ size = 12 }: TelegramIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M14.7 2.2 1.6 7.3c-.6.2-.6.9 0 1.1l3.1 1 1.2 3.8c.2.5.8.6 1.1.2l1.7-1.7 3.2 2.4c.4.3 1 .1 1.1-.4l2.3-10.7c.1-.6-.4-1-.9-.8Zm-2.4 2.5L7 9.6l-.2 2.3-.8-2.6 6.3-4.6Z" />
    </svg>
  )
}
