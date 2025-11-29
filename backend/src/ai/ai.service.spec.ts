import { AiService } from './ai.service';

describe('AiService', () => {
  beforeAll(() => {
    process.env.OPENAI_API_KEY = 'test-key';
  });

  it('extractStructureFromPoster returns structured data from OpenAI', async () => {
    const mockStructure = {
      posterContext: {
        parishName: 'St. Demo',
        overallTheme: null,
        overallDescription: null,
      },
      events: [
        {
          id: 'event1',
          title: 'Advent Mass',
          startDateTime: '2025-12-01T10:00:00-07:00',
          endDateTime: null,
          isAllDay: false,
          location: 'Parish Hall',
          rawText: 'Advent Mass Dec 1 @ 10am',
          notes: null,
          uncertainty: null,
        },
      ],
      relationships: [],
    };

    const mockOpenAi = {
      responses: {
        create: jest.fn().mockResolvedValue({ output_text: JSON.stringify(mockStructure) }),
      },
    };

    const service = new AiService(mockOpenAi as any);
    const result = await (service as any).extractStructureFromPoster(
      { buffer: Buffer.from('demo') } as Express.Multer.File,
      { parishTimezone: 'America/Edmonton', currentDate: new Date('2025-11-01T00:00:00Z') },
    );

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({ id: 'event1', title: 'Advent Mass' });
    expect(mockOpenAi.responses.create).toHaveBeenCalled();
  });

  it('generateDescriptionsFromStructure maps ids to descriptions', async () => {
    const mockResponse = {
      events: [{ id: 'event1', description: 'Join us for Advent Mass.' }],
    };
    const mockOpenAi = {
      responses: {
        create: jest.fn().mockResolvedValue({ output_text: JSON.stringify(mockResponse) }),
      },
    };
    const service = new AiService(mockOpenAi as any);
    const structure = {
      posterContext: { parishName: null, overallTheme: null, overallDescription: null },
      events: [
        {
          id: 'event1',
          title: 'Advent Mass',
          startDateTime: '2025-12-01T10:00:00-07:00',
          endDateTime: null,
          isAllDay: false,
          location: null,
          rawText: null,
          notes: null,
          uncertainty: null,
        },
      ],
      relationships: [],
    };

    const descriptions = await (service as any).generateDescriptionsFromStructure(structure);
    expect(descriptions).toEqual(mockResponse.events);
    expect(mockOpenAi.responses.create).toHaveBeenCalled();
  });
});

