import z from "zod";
import { db } from "../../infra/db";
import { FastifyInstance } from "fastify";

export async function createPoll(app: FastifyInstance) {
  app.post("/polls", async (request, response) => {
    const createPollBody = z.object({
      title: z.string(),
      options: z.array(z.string()),
    });
    const { title, options } = createPollBody.parse(request.body);
    const poll = await db.poll.create({
      data: {
        title,
        PollOption: {
          createMany: {
            data: options.map((option) => {
              return {
                title: option,
              };
            }),
          },
        },
      },
    });

    return response.status(201).send({ pollId: poll.id });
  });
}
