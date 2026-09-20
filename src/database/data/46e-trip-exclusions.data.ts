// Trip exclusions — 2 par voyage × 5 = 10 (traductions en 46f).
const E = (id: string, tripId: string, sortOrder: number) => ({ id, tripId, sortOrder });
export default [
  E("b91f9ba9-7265-4a6f-a35d-674b6eda616a", "26cf16d8-0770-48f9-870e-c68c9a9c47e0", 0),
  E("c6dfcc25-4b38-493b-a4cc-8c70471a6ca9", "26cf16d8-0770-48f9-870e-c68c9a9c47e0", 1),
  E("6d4b92a7-4a10-4a2f-ad6f-40dee72d9c0b", "b912b620-1d69-448f-a289-4790b4ce271c", 0),
  E("47302202-9346-472e-a8be-4d7fe22b7b58", "b912b620-1d69-448f-a289-4790b4ce271c", 1),
  E("9ea32226-f074-44e4-a4f0-e33460db1e83", "22b3db08-f245-44eb-8ee2-a858eb7e25c4", 0),
  E("a53e6cd1-765d-4605-a50a-32328909e74c", "22b3db08-f245-44eb-8ee2-a858eb7e25c4", 1),
  E("37c80df3-d19d-4183-a660-d8143cf8c970", "2c45ce15-a211-4a07-9472-1539aae514c5", 0),
  E("47e4930c-5c99-4dd1-a558-d56b5941e818", "2c45ce15-a211-4a07-9472-1539aae514c5", 1),
  E("2d37d564-8b34-4470-a45b-654412ee6265", "6675b138-4572-4283-b866-b64840f63004", 0),
  E("13c3a25a-1b84-429e-a2da-440883e83eb3", "6675b138-4572-4283-b866-b64840f63004", 1),
];
