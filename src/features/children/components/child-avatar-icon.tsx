import { Bird, Cat, Dog, Fish, Flower2, Rabbit, Rocket, Turtle } from "lucide-react";

import type { ChildAvatarKey } from "../appearance";

const icons = { cat: Cat, dog: Dog, rabbit: Rabbit, bird: Bird, fish: Fish, turtle: Turtle, rocket: Rocket, flower: Flower2 };

export function ChildAvatarIcon({ name }: { name: Exclude<ChildAvatarKey, "initials"> }) {
  const Icon = icons[name];
  return <Icon aria-hidden className="h-[62%] w-[62%]" strokeWidth={1.8} />;
}
