import z from "zod";
import { db } from "../../infra/db";
import { FastifyInstance } from "fastify";
import { redis } from "../../infra/redis";

export async function getPoll(app: FastifyInstance) {
  app.get("/polls/:pollId", async (request, response) => {
    const getPollParams = z.object({
      pollId: z.string().uuid(),
    });

    const { pollId } = getPollParams.parse(request.params);
    const poll = await db.poll.findUnique({
      where: {
        id: pollId,
      },
      include: {
        PollOption: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!poll) return response.status(400).send({ message: "not found" });

    const result = await redis.zrange(pollId, 0, -1, "WITHSCORES");

    const votes = result.reduce((obj, line, index) => {
      if (index % 2 === 0) {
        const score = result[index + 1];

        Object.assign(obj, { [line]: score });
      }
      return obj;
    }, {} as Record<string, number>);

    console.log(votes);
    return response.status(200).send({
      poll: {
        id: poll.id,
        title: poll.title,
        option: poll.PollOption.map((option) => {
          return {
            id: option.id,
            title: option.title,
            score: option.id in votes ? votes[option.id] : 0,
          };
        }),
      },
    });
  });
}
