FROM oven/bun:1-alpine

ENV RUNTIME_ENV container

RUN addgroup \
        -g 3000 \
        scarlet
RUN adduser -HD \
        -u 3000 \
        -G scarlet \
        -h /workplace \
        flandre

RUN mkdir -p /workplace
WORKDIR /workplace
ADD . /workplace

RUN chown -R \
        3000:3000 \
        /workplace

USER 3000
RUN bun install

CMD ["bun", "start"]
