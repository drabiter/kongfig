FROM node:5-slim
WORKDIR /app
ADD . /app
RUN npm run build
CMD ["/bin/bash"]

